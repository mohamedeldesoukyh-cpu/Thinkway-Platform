/**
 * Q4 timeout fix — before/after timing (service role, no secrets printed).
 * Usage: npx tsx scripts/intelligence-q4-timing.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !serviceKey?.startsWith("eyJ")) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or valid SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = supabase.schema("intelligence");

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  console.log(`${label}: ${ms} ms`);
  return { ms, result };
}

async function main() {
  const tableCounts = await Promise.all([
    db.from("int_margin_history").select("*", { count: "exact", head: true }),
    db
      .from("int_margin_history")
      .select("*", { count: "exact", head: true })
      .not("margin_pct", "is", null),
  ]);

  const totalMarginRows = tableCounts[0].count ?? 0;
  const nonNullMarginRows = tableCounts[1].count ?? 0;

  console.log("\n=== Row counts ===");
  console.log(`int_margin_history total: ${totalMarginRows}`);
  console.log(`int_margin_history margin_pct IS NOT NULL: ${nonNullMarginRows}`);

  console.log("\n=== Before (simulate Q4 PostgREST row fetch) ===");
  const oldQ4 = await timed("Q4 old marginRows fetch", async () => {
    const { data, error } = await db
      .from("int_margin_history")
      .select("margin_pct")
      .not("margin_pct", "is", null)
      .limit(5000);
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  });

  console.log("\n=== After (get_margin_median RPC) ===");
  const newRpc = await timed("Q4 new get_margin_median RPC", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_margin_median");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row?.median_margin_pct ?? null;
  });

  console.log("\n=== Full 6-query Promise.all bundle (post-fix) ===");
  const bundle = await timed("6-query parallel bundle", async () => {
    const [workspaceCounts, workspaceFinancials, marginMedian, topInfluencerCampaigns, benchmarks, marginAlerts] =
      await Promise.all([
        supabase.schema("intelligence").rpc("get_workspace_counts"),
        supabase.schema("intelligence").rpc("get_campaign_financial_totals"),
        supabase.schema("intelligence").rpc("get_margin_median"),
        db
          .from("int_campaigns")
          .select(
            "int_influencer_id, cost_usd, margin_pct, int_influencers(display_name_raw, username, platform, country, tier, match_confidence)"
          )
          .not("int_influencer_id", "is", null)
          .limit(8000),
        db
          .from("int_benchmarks")
          .select(
            "id, benchmark_key, period_year, median_cost_usd, median_margin_pct, p25_margin_pct, p75_margin_pct, sample_size, dimensions"
          )
          .order("sample_size", { ascending: false })
          .limit(50),
        db
          .from("int_margin_history")
          .select(
            "id, source_line_id, margin_pct, revenue_usd, cost_usd, market_entity, channel, period_year, int_campaigns(campaign_name, brand_name_raw, influencer_name_raw, client_type_report)"
          )
          .eq("below_threshold_15pct", true)
          .order("margin_pct", { ascending: true })
          .limit(40),
      ]);

    const errors = [
      workspaceCounts.error,
      workspaceFinancials.error,
      marginMedian.error,
      topInfluencerCampaigns.error,
      benchmarks.error,
      marginAlerts.error,
    ].filter(Boolean);

    return {
      errors: errors.map((e) => e?.message ?? "unknown"),
      rows: {
        marginMedian: Array.isArray(marginMedian.data) ? marginMedian.data.length : 0,
        topInfluencerCampaigns: topInfluencerCampaigns.data?.length ?? 0,
        benchmarks: benchmarks.data?.length ?? 0,
        marginAlerts: marginAlerts.data?.length ?? 0,
      },
    };
  });

  const docPath = resolve("docs/INTELLIGENCE_Q4_TIMEOUT_FIX.md");
  const header = `# Intelligence Q4 Timeout Fix

> **Applied:** 2026-06-16 · Replaces Q4 \`int_margin_history\` row fetch with \`get_margin_median()\` SECURITY DEFINER RPC.

## Change summary

| Item | Before | After |
| --- | --- | --- |
| Q4 query | \`int_margin_history.select("margin_pct").not(...).limit(5000)\` | \`rpc("get_margin_median")\` |
| Median computation | JS \`median()\` on up to 1,000 PostgREST rows | SQL \`percentile_disc(0.5)\` on full non-null population |
| Migration | — | \`20260624020000_intelligence_margin_median_rpc.sql\` |

## Warehouse row counts (service role)

| Table / filter | Rows |
| --- | ---: |
| \`int_margin_history\` total | ${totalMarginRows} |
| \`margin_pct IS NOT NULL\` | ${nonNullMarginRows} |

## Timing (service role, ${new Date().toISOString().slice(0, 10)})

Service role bypasses RLS; authenticated sessions may differ. RPCs guarded by \`can_read_intelligence()\` return empty under service role.

| Query | ms | Rows / result |
| --- | ---: | --- |
| **Before** — Q4 old \`marginRows\` PostgREST fetch | ${oldQ4.ms} | ${oldQ4.result} rows returned (PostgREST default cap 1,000) |
| **After** — Q4 \`get_margin_median\` RPC | ${newRpc.ms} | median = ${newRpc.result ?? "null"} (${Array.isArray(newRpc.result) ? newRpc.result.length : newRpc.result === null ? 0 : 1} RPC row; empty under service role) |
| **After** — full 6-query \`Promise.all\` bundle | ${bundle.ms} | Q6=${bundle.result.rows.topInfluencerCampaigns}, Q7=${bundle.result.rows.benchmarks}, Q8=${bundle.result.rows.marginAlerts} |
`;

  const footer =
    bundle.result.errors.length > 0
      ? `\n### Bundle errors\n\n${bundle.result.errors.map((e) => `- ${e}`).join("\n")}\n`
      : "\n### Bundle errors\n\nNone.\n";

  const existing = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
  const runSection = `\n---\n\n## Run ${new Date().toISOString()}\n\n${header.split("## Timing")[1] ? "" : ""}`;

  if (existing.includes("## Timing")) {
    const timingBlock = `## Timing (service role, ${new Date().toISOString().slice(0, 10)})

Service role bypasses RLS; authenticated sessions may differ. RPCs guarded by \`can_read_intelligence()\` return empty under service role.

| Query | ms | Rows / result |
| --- | ---: | --- |
| **Before** — Q4 old \`marginRows\` PostgREST fetch | ${oldQ4.ms} | ${oldQ4.result} rows returned (PostgREST default cap 1,000) |
| **After** — Q4 \`get_margin_median\` RPC | ${newRpc.ms} | median = ${newRpc.result ?? "null"} (RPC row count varies by auth) |
| **After** — full 6-query \`Promise.all\` bundle | ${bundle.ms} | Q6=${bundle.result.rows.topInfluencerCampaigns}, Q7=${bundle.result.rows.benchmarks}, Q8=${bundle.result.rows.marginAlerts} |
${footer}`;
    writeFileSync(docPath, `${existing.trim()}\n\n---\n\n## Run ${new Date().toISOString()}\n\n${timingBlock}`);
  } else {
    writeFileSync(docPath, header + footer);
  }

  console.log(`\nWrote timings to ${docPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
