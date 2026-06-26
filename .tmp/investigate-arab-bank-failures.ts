#!/usr/bin/env npx tsx
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
if (existsSync(path.join(root, ".env.local"))) config({ path: path.join(root, ".env.local") });
config({ path: path.join(root, ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: headers, error: hErr } = await supabase
    .from("campaign_headers")
    .select("id, document_number, name")
    .or("name.ilike.%Arab Bank%,name.ilike.%La Liga%");

  if (hErr) throw hErr;
  console.log("=== CAMPAIGN HEADERS ===");
  console.log(JSON.stringify(headers, null, 2));

  const header = headers?.find(
    (h) => h.name && /arab bank|la liga/i.test(h.name)
  );
  if (!header) {
    console.error("No matching campaign header found");
    process.exit(1);
  }

  const { data: allPubs, error: allErr } = await supabase
    .from("campaign_publications")
    .select(
      "id, content_url, platform, metrics_refresh_status, metrics_provider, metrics_collection_source, metrics_refresh_attempted_at"
    )
    .eq("campaign_header_id", header.id)
    .order("created_at", { ascending: true });

  if (allErr) throw allErr;
  console.log("\n=== ALL PUBLICATIONS (metrics status) ===");
  console.log(JSON.stringify(allPubs, null, 2));

  const { data: pubs, error: pErr } = await supabase
    .from("campaign_publications")
    .select(
      "id, content_url, platform, metrics_refresh_status, metrics_provider, metrics_collection_source, metrics_refresh_attempted_at, influencer_id"
    )
    .eq("campaign_header_id", header.id)
    .eq("metrics_refresh_status", "failed");

  if (pErr) throw pErr;
  console.log("\n=== FAILED PUBLICATIONS ===");
  console.log(JSON.stringify(pubs, null, 2));

  const pubIds = (pubs ?? []).map((p) => p.id);
  if (pubIds.length === 0) {
    console.log("No failed publications");
    return;
  }

  const { data: logs, error: lErr } = await supabase
    .from("publication_metric_sync_logs")
    .select(
      "id, publication_id, provider, status, error, error_code, message, response_summary, metrics_refresh_status, attempt_order, created_at, completed_at, duration_ms, triggered_by"
    )
    .in("publication_id", pubIds)
    .order("created_at", { ascending: false });

  if (lErr) throw lErr;

  console.log("\n=== ALL SYNC LOGS FOR FAILED PUBLICATIONS ===");
  console.log(JSON.stringify(logs, null, 2));

  for (const pubId of pubIds) {
    const pub = pubs?.find((p) => p.id === pubId);
    const pubLogs = (logs ?? []).filter((l) => l.publication_id === pubId);
    const latestByProvider = new Map<string, (typeof pubLogs)[0]>();
    for (const log of pubLogs) {
      const key = `${log.provider}:${log.attempt_order}`;
      if (!latestByProvider.has(key)) latestByProvider.set(key, log);
    }
    console.log(`\n=== LATEST LOGS PER PROVIDER: ${pubId} ===`);
    console.log(`URL: ${pub?.content_url}`);
    console.log(`triggered_by (latest run): ${pubLogs[0]?.triggered_by ?? "n/a"}`);
    for (const log of pubLogs.slice(0, 10)) {
      console.log(
        JSON.stringify(
          {
            publication_id: log.publication_id,
            provider: log.provider,
            status: log.status,
            error: log.error,
            error_code: log.error_code,
            message: log.message,
            response_summary: log.response_summary,
            created_at: log.created_at,
          },
          null,
          2
        )
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
