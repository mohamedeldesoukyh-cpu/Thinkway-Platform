/**
 * Production soak — progressive Studio / Creator Detail load (read-only).
 * Target: Supabase ienowhwfyxoqtzbgltno only.
 *
 * Usage:
 *   npx tsx scripts/soak-studio-creator-detail-progressive-production.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hydrateCreatorsFromDna } from "../features/creator-dna/services/creator-hydration-service";
import { enrichCreatorsWithEciInvestment } from "../features/discovery/services/eci/enrich-creators-with-eci";
import { loadStudioEciPlanningSignals } from "../features/campaign-studio/services/eci/load-studio-eci-signals";
import { getUnifiedCreatorById, browseUnifiedCreators } from "../lib/creators/unified-browse";
import { loadCreatorHistoricalMetrics } from "../lib/creators/historical-metrics";
import { findSimilarCreators } from "../lib/creators/similar-creators";
import { tryCreateServiceRoleClient } from "../lib/supabase/service-role-client";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

const PROD_REF = "ienowhwfyxoqtzbgltno";

// Prefer Production pull/local files; ignore Development `.env` overrides.
loadEnvFile(resolve(".env.vercel.production.pull"));
loadEnvFile(resolve(".env.production.local"));

function forceProdEnvFromFiles(paths: string[]) {
  for (const file of paths) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i <= 0) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (
        k === "NEXT_PUBLIC_SUPABASE_URL" ||
        k === "SUPABASE_URL" ||
        k === "SUPABASE_SERVICE_ROLE_KEY"
      ) {
        if (v) process.env[k] = v;
      }
    }
  }
}
forceProdEnvFromFiles([
  resolve(".env.vercel.production.pull"),
  resolve(".env.production.local"),
]);

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  "";
if (!url.includes(PROD_REF)) {
  console.error("Refuse: not Production Supabase", url);
  process.exit(1);
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}

type Check = { name: string; ok: boolean; detail: string; ms?: number };

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t0 };
}

async function main() {
  console.log("=== PRODUCTION progressive-load soak ===");
  console.log("target", PROD_REF);

  const resolved = tryCreateServiceRoleClient();
  if (!resolved.client) {
    console.error("No service role client", resolved.reason);
    process.exit(1);
  }
  const supabase = resolved.client;
  const checks: Check[] = [];

  const { data: influencers, error: infErr } = await supabase
    .from("influencers")
    .select("id, display_name")
    .eq("enrichment_status", "enriched")
    .order("last_enriched_at", { ascending: false })
    .limit(12);
  if (infErr || !influencers?.length) {
    throw new Error(`Influencer seed failed: ${infErr?.message ?? "empty"}`);
  }
  const ids = influencers.map((r) => `inf:${r.id}`);
  const primary = influencers[0]!;
  const unifiedId = `inf:${primary.id}`;

  {
    const seed = ids.slice(0, 8);
    const dnaT = await timed(() =>
      hydrateCreatorsFromDna(supabase, seed, {
        includeEci: false,
        includeQuotationPrices: false,
      })
    );
    const eciT = await timed(() => loadStudioEciPlanningSignals(supabase, seed));
    checks.push({
      name: "Studio.phase1.dnaViewportSeed",
      ok: dnaT.result.vendors.length > 0,
      detail: `n=${dnaT.result.vendors.length}`,
      ms: dnaT.ms,
    });
    checks.push({
      name: "Studio.phase2.eciOverlay",
      ok: eciT.result.size > 0,
      detail: `signals=${eciT.result.size}`,
      ms: eciT.ms,
    });
    checks.push({
      name: "Studio.phase2Ready",
      ok: dnaT.ms + eciT.ms < 2500,
      detail: `sum=${dnaT.ms + eciT.ms}ms (prod network budget looser than local Dev)`,
      ms: dnaT.ms + eciT.ms,
    });
  }

  {
    const coreT = await timed(() => getUnifiedCreatorById(supabase, unifiedId));
    const core = coreT.result;
    checks.push({
      name: "CreatorDetail.fmpShell",
      ok: Boolean(core?.display_name && (core.platforms?.length ?? 0) > 0),
      detail: `name=${core?.display_name ?? "?"} (FMP uses list-row; core refresh=${coreT.ms}ms)`,
      ms: 0,
    });
    const eciT = await timed(async () => {
      if (!core) return null;
      const [enriched] = await enrichCreatorsWithEciInvestment(supabase, [core], {
        concurrency: 1,
      });
      return enriched;
    });
    checks.push({
      name: "CreatorDetail.eciCorrectness",
      ok:
        eciT.result?.eci_investment_score != null ||
        Boolean(eciT.result?.eci_investment_recommendation),
      detail: `score=${eciT.result?.eci_investment_score ?? "null"} rec=${eciT.result?.eci_investment_recommendation ?? "null"}`,
      ms: eciT.ms,
    });
    const hist = await loadCreatorHistoricalMetrics(supabase, unifiedId);
    const similar = core
      ? await findSimilarCreators(supabase, core, 4).catch(() => [])
      : [];
    checks.push({
      name: "CreatorDetail.phase3.panels",
      ok: hist != null && Array.isArray(similar),
      detail: `history=${hist?.followers?.length ?? 0} similar=${similar.length}`,
    });
  }

  {
    const browse = await browseUnifiedCreators(supabase, { page: 1, pageSize: 8 }, "soak");
    checks.push({
      name: "Discovery.browse",
      ok: (browse.creators?.length ?? 0) > 0,
      detail: `creators=${browse.creators?.length ?? 0}`,
    });
  }

  for (const [name, table, cols] of [
    ["Shortlists", "discovery_shortlists", "id, name"],
    ["Quotation", "quotations", "id, name, status"],
    ["CampaignWorkspace", "campaign_headers", "id, document_number, name, status"],
    ["Proposal", "campaign_objects", "id, lifecycle_status, current_version"],
  ] as const) {
    const { data, error } = await supabase.from(table).select(cols).limit(3);
    checks.push({
      name: `${name}.reachable`,
      ok: !error,
      detail: error?.message ?? `rows=${data?.length ?? 0}`,
    });
  }

  console.log("\nResults:");
  let failed = 0;
  for (const c of checks) {
    const timing = c.ms != null ? ` [${c.ms}ms]` : "";
    console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name}${timing} — ${c.detail}`);
    if (!c.ok) failed += 1;
  }
  console.log(
    JSON.stringify(
      {
        environment: "Production",
        projectRef: PROD_REF,
        influencerId: primary.id,
        tip: "d34bcff6",
        passed: checks.length - failed,
        failed,
        checks,
      },
      null,
      2
    )
  );
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
