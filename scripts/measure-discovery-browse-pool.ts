/**
 * Before/after measurement for Discovery browse ID pagination.
 *
 * Usage:
 *   DISCOVERY_SEARCH_PERF=1 npx tsx scripts/measure-discovery-browse-pool.ts
 *
 * Requires SUPABASE_URL + service role or anon key with read access, and
 * migration 20260721120000_browse_influencer_ids_by_recency applied for RPC path.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });
loadEnv();

import {
  queryBrowsableInfluencerIdsByRecency,
  queryBrowsableInfluencerIdsByRecencyLegacy,
} from "@/lib/creators/discovery-browse-pool";

async function timeMs<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; ms: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  return { label, ms, result };
}

function approxPayloadBytes(ids: string[], total: number): number {
  return JSON.stringify({ ids, total }).length;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing SUPABASE URL / key env vars.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const page = 1;
  const pageSize = 120;
  const filters = {};

  console.log("--- Discovery browse pool measurement ---");
  console.log(`page=${page} pageSize=${pageSize}`);

  const rpcRun = await timeMs("rpc_or_auto", () =>
    queryBrowsableInfluencerIdsByRecency(supabase, filters, page, pageSize)
  );

  const legacyRun = await timeMs("legacy_full_catalog", () =>
    queryBrowsableInfluencerIdsByRecencyLegacy(supabase, filters, page, pageSize)
  );

  const legacyIds = new Set(legacyRun.result.ids);
  const overlap = rpcRun.result.ids.filter((id) => legacyIds.has(id)).length;

  console.log(
    JSON.stringify(
      {
        rpc_or_auto: {
          source: rpcRun.result.source,
          ms: rpcRun.ms,
          idCount: rpcRun.result.ids.length,
          total: rpcRun.result.total,
          payloadBytes: approxPayloadBytes(rpcRun.result.ids, rpcRun.result.total),
        },
        legacy_full_catalog: {
          source: legacyRun.result.source,
          ms: legacyRun.ms,
          idCount: legacyRun.result.ids.length,
          total: legacyRun.result.total,
          payloadBytes: approxPayloadBytes(legacyRun.result.ids, legacyRun.result.total),
          // Rough memory proxy: full catalog size in ID strings for the sorted set
          catalogIdCount: legacyRun.result.total,
        },
        page_overlap: {
          overlap,
          rpcOnly: rpcRun.result.ids.length - overlap,
          speedup:
            legacyRun.ms > 0
              ? `${(legacyRun.ms / Math.max(rpcRun.ms, 1)).toFixed(2)}x`
              : "n/a",
        },
      },
      null,
      2
    )
  );

  if (rpcRun.result.source !== "rpc") {
    console.warn(
      "RPC path not active (migration missing?). Apply 20260721120000_browse_influencer_ids_by_recency.sql and re-run."
    );
  }

  // Overlap is informative; pin-pool + sort pool may not be identical page sets
  // when totals differ slightly. Warn only on empty RPC results with legacy hits.
  if (rpcRun.result.source === "rpc" && rpcRun.result.ids.length === 0 && legacyRun.result.ids.length > 0) {
    console.error("Regression signal: RPC returned 0 IDs while legacy returned results.");
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
