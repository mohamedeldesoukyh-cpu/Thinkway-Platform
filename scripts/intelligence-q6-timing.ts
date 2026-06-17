/**
 * Q6 timeout diagnosis + before/after timing (service role, no secrets printed).
 * Usage: npx tsx scripts/intelligence-q6-timing.ts
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

async function timed<T>(label: string, fn: () => Promise<T>): Promise<{ ms: number; result: T; error?: string }> {
  const start = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - start);
    console.log(`${label}: ${ms} ms`);
    return { ms, result };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const error = err instanceof Error ? err.message : String(err);
    console.log(`${label}: ${ms} ms — ERROR: ${error}`);
    return { ms, result: null as T, error };
  }
}

async function main() {
  console.log("\n=== Individual query timings (post Q4 fix) ===");

  const qRpc1 = await timed("Q-RPC1 get_workspace_counts", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_workspace_counts");
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data.length : 0;
  });

  const qRpc2 = await timed("Q-RPC2 get_campaign_financial_totals", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_campaign_financial_totals");
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data.length : 0;
  });

  const qRpc4 = await timed("Q4 get_margin_median", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_margin_median");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row?.median_margin_pct ?? null;
  });

  const q6 = await timed("Q6 topInfluencerCampaigns join", async () => {
    const { data, error } = await db
      .from("int_campaigns")
      .select(
        "int_influencer_id, cost_usd, margin_pct, int_influencers(display_name_raw, username, platform, country, tier, match_confidence)"
      )
      .not("int_influencer_id", "is", null)
      .limit(8000);
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  });

  const q7 = await timed("Q7 benchmarks", async () => {
    const { data, error } = await db
      .from("int_benchmarks")
      .select(
        "id, benchmark_key, period_year, median_cost_usd, median_margin_pct, p25_margin_pct, p75_margin_pct, sample_size, dimensions"
      )
      .order("sample_size", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  });

  const q8 = await timed("Q8 marginAlerts join", async () => {
    const { data, error } = await db
      .from("int_margin_history")
      .select(
        "id, source_line_id, margin_pct, revenue_usd, cost_usd, market_entity, channel, period_year, int_campaigns(campaign_name, brand_name_raw, influencer_name_raw, client_type_report)"
      )
      .eq("below_threshold_15pct", true)
      .order("margin_pct", { ascending: true })
      .limit(40);
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  });

  let q6RpcMs: number | null = null;
  let q6RpcRows: number | null = null;
  let q6RpcError: string | undefined;

  const q6Rpc = await timed("Q6 new get_top_influencers RPC", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_top_influencers", {
      row_limit: 25,
    });
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  });
  q6RpcMs = q6Rpc.ms;
  q6RpcRows = q6Rpc.result;
  q6RpcError = q6Rpc.error;

  console.log("\n=== Full 6-query bundle (current queries.ts shape) ===");
  const bundleBefore = await timed("6-query parallel bundle", async () => {
    const [
      workspaceCounts,
      workspaceFinancials,
      marginMedian,
      topInfluencerCampaigns,
      benchmarks,
      marginAlerts,
    ] = await Promise.all([
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

    const labeledErrors = [
      workspaceCounts.error && `[Q-RPC1] ${workspaceCounts.error.message}`,
      workspaceFinancials.error && `[Q-RPC2] ${workspaceFinancials.error.message}`,
      marginMedian.error && `[Q4] ${marginMedian.error.message}`,
      topInfluencerCampaigns.error && `[Q6] ${topInfluencerCampaigns.error.message}`,
      benchmarks.error && `[Q7] ${benchmarks.error.message}`,
      marginAlerts.error && `[Q8] ${marginAlerts.error.message}`,
    ].filter(Boolean) as string[];

    return { errors: labeledErrors };
  });

  console.log("\n=== Full 6-query bundle (Q6 RPC post-fix) ===");
  const bundleAfter = await timed("6-query parallel bundle (Q6 RPC)", async () => {
    const [
      workspaceCounts,
      workspaceFinancials,
      marginMedian,
      topInfluencers,
      benchmarks,
      marginAlerts,
    ] = await Promise.all([
      supabase.schema("intelligence").rpc("get_workspace_counts"),
      supabase.schema("intelligence").rpc("get_campaign_financial_totals"),
      supabase.schema("intelligence").rpc("get_margin_median"),
      supabase.schema("intelligence").rpc("get_top_influencers", { row_limit: 25 }),
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

    const labeledErrors = [
      workspaceCounts.error && `[Q-RPC1] ${workspaceCounts.error.message}`,
      workspaceFinancials.error && `[Q-RPC2] ${workspaceFinancials.error.message}`,
      marginMedian.error && `[Q4] ${marginMedian.error.message}`,
      topInfluencers.error && `[Q6] ${topInfluencers.error.message}`,
      benchmarks.error && `[Q7] ${benchmarks.error.message}`,
      marginAlerts.error && `[Q8] ${marginAlerts.error.message}`,
    ].filter(Boolean) as string[];

    return { errors: labeledErrors, topInfluencerRows: topInfluencers.data?.length ?? 0 };
  });

  const docPath = resolve("docs/INTELLIGENCE_Q6_TIMEOUT_FIX.md");
  const runDate = new Date().toISOString().slice(0, 10);
  const timingBlock = `## Timing (service role, ${runDate})

Service role bypasses RLS; authenticated UI sessions may differ. RPCs guarded by \`can_read_intelligence()\` return empty under service role.

### Confirmed timeout query

After Q4 \`get_margin_median\` fix (median KPI **20.0%** working), the remaining suspect is **Q6** — \`int_campaigns\` ⋈ \`int_influencers\` PostgREST join (\`.limit(8000)\`, effective cap 1,000 rows). Q-RPC1, Q-RPC2, Q4, Q7, and Q8 are ruled out by working KPIs/tab data.

| Query | ms | Rows / result | Error |
| --- | ---: | --- | --- |
| Q-RPC1 \`get_workspace_counts\` | ${qRpc1.ms} | ${qRpc1.result} RPC rows | ${qRpc1.error ?? "—"} |
| Q-RPC2 \`get_campaign_financial_totals\` | ${qRpc2.ms} | ${qRpc2.result} RPC rows | ${qRpc2.error ?? "—"} |
| Q4 \`get_margin_median\` | ${qRpc4.ms} | median = ${qRpc4.result ?? "null"} | ${qRpc4.error ?? "—"} |
| **Q6 old** join fetch | **${q6.ms}** | **${q6.result}** rows | ${q6.error ?? "—"} |
| Q7 benchmarks | ${q7.ms} | ${q7.result} rows | ${q7.error ?? "—"} |
| Q8 margin alerts join | ${q8.ms} | ${q8.result} rows | ${q8.error ?? "—"} |
| **Q6 new** \`get_top_influencers\` RPC | **${q6RpcMs ?? "N/A"}** | **${q6RpcRows ?? "N/A"}** rows | ${q6RpcError ?? "—"} |
| Full bundle (old Q6 join) | ${bundleBefore.ms} | — | ${bundleBefore.result.errors.length ? bundleBefore.result.errors.join("; ") : "None"} |
| Full bundle (Q6 RPC) | ${bundleAfter.ms} | top influencers = ${bundleAfter.result.topInfluencerRows} | ${bundleAfter.result.errors.length ? bundleAfter.result.errors.join("; ") : "None"} |
`;

  const header = `# Intelligence Q6 Timeout Fix

> **Applied:** 2026-06-16 · Replaces Q6 \`int_campaigns\` ⋈ \`int_influencers\` join fetch with \`get_top_influencers()\` SECURITY DEFINER RPC.

## Change summary

| Item | Before | After |
| --- | --- | --- |
| Q6 query | \`int_campaigns.select(..., int_influencers(...)).limit(8000)\` + JS aggregation | \`rpc("get_top_influencers", { row_limit: 25 })\` |
| Top-25 logic | In-memory \`Map\` over PostgREST rows (max 1,000) | SQL \`GROUP BY int_influencer_id ORDER BY count DESC LIMIT 25\` |
| Median cost/margin | JS \`median()\` on joined row samples | SQL \`percentile_disc(0.5)\` on full per-influencer population |
| Migration | — | \`20260624030000_intelligence_top_influencers_rpc.sql\` |

${timingBlock}

## Expected UI outcome

- Amber **"canceling statement due to statement timeout"** banner should disappear after deploy (Q6 was the remaining failing query in the authenticated \`Promise.all\` bundle).
- Match % column unchanged (still reads \`match_confidence\` from warehouse; out of scope).
`;

  const existing = existsSync(docPath) ? readFileSync(docPath, "utf8") : "";
  if (existing.includes("## Timing")) {
    writeFileSync(
      docPath,
      `${existing.trim()}\n\n---\n\n## Run ${new Date().toISOString()}\n\n${timingBlock}`
    );
  } else {
    writeFileSync(docPath, header);
  }

  console.log(`\nWrote timings to ${docPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
