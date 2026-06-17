/**
 * Q8 timeout diagnosis + before/after timing (service role, no secrets printed).
 * Usage: npx tsx scripts/intelligence-q8-timing.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
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
  console.log("\n=== Warehouse below-threshold count (direct SQL) ===");
  const warehouseCount = await timed("Direct count below_threshold_15pct", async () => {
    const { count, error } = await db
      .from("int_margin_history")
      .select("id", { count: "exact", head: true })
      .eq("below_threshold_15pct", true);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });

  console.log("\n=== Individual query timings (post Q6 fix) ===");

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

  const q6Rpc = await timed("Q6 get_top_influencers RPC", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_top_influencers", {
      row_limit: 25,
    });
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

  const q8Old = await timed("Q8 old marginAlerts join", async () => {
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

  const q8CountRpc = await timed("Q8a new get_low_margin_line_count RPC", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_low_margin_line_count");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row?.low_margin_line_count ?? 0;
  });

  const q8AlertsRpc = await timed("Q8b new get_margin_alerts RPC", async () => {
    const { data, error } = await supabase.schema("intelligence").rpc("get_margin_alerts", {
      row_limit: 40,
    });
    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  });

  console.log("\n=== Full 7-query bundle (current queries.ts shape, Q8 RPC post-fix) ===");
  const bundleAfter = await timed("7-query parallel bundle (Q8 RPC)", async () => {
    const [
      workspaceCounts,
      workspaceFinancials,
      marginMedian,
      topInfluencers,
      benchmarks,
      lowMarginLineCount,
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
      supabase.schema("intelligence").rpc("get_low_margin_line_count"),
      supabase.schema("intelligence").rpc("get_margin_alerts", { row_limit: 40 }),
    ]);

    const labeledErrors = [
      workspaceCounts.error && `[Q-RPC1] ${workspaceCounts.error.message}`,
      workspaceFinancials.error && `[Q-RPC2] ${workspaceFinancials.error.message}`,
      marginMedian.error && `[Q4] ${marginMedian.error.message}`,
      topInfluencers.error && `[Q6] ${topInfluencers.error.message}`,
      benchmarks.error && `[Q7] ${benchmarks.error.message}`,
      lowMarginLineCount.error && `[Q8a] ${lowMarginLineCount.error.message}`,
      marginAlerts.error && `[Q8b] ${marginAlerts.error.message}`,
    ].filter(Boolean) as string[];

    const countRow = Array.isArray(lowMarginLineCount.data)
      ? lowMarginLineCount.data[0]
      : lowMarginLineCount.data;

    return {
      errors: labeledErrors,
      topInfluencerRows: topInfluencers.data?.length ?? 0,
      lowMarginCount: countRow?.low_margin_line_count ?? 0,
      marginAlertRows: marginAlerts.data?.length ?? 0,
    };
  });

  const runDate = new Date().toISOString().slice(0, 10);
  const docPath = resolve("docs/INTELLIGENCE_Q8_TIMEOUT_FIX.md");

  const header = `# Intelligence Q8 Timeout Fix

> **Applied:** ${runDate} · Replaces Q8 \`int_margin_history\` ⋈ \`int_campaigns\` PostgREST join with \`get_low_margin_line_count()\` + \`get_margin_alerts()\` SECURITY DEFINER RPCs.

## Change summary

| Item | Before | After |
| --- | --- | --- |
| Q8 KPI count | \`marginAlerts.data.length\` (capped at 40, wrong if timeout) | \`rpc("get_low_margin_line_count")\` — full \`count(*)\` via partial index |
| Q8 tab rows | \`int_margin_history.select(..., int_campaigns(...)).limit(40)\` | \`rpc("get_margin_alerts", { row_limit: 40 })\` |
| Join logic | PostgREST embed join under RLS | SQL \`JOIN int_campaigns\` inside SECURITY DEFINER |
| Migration | — | \`20260624040000_intelligence_margin_alerts_rpc.sql\` |

## Warehouse verification

| Source | Below-threshold lines (\`below_threshold_15pct = true\`) |
| --- | ---: |
| Direct warehouse count (service role) | **${warehouseCount.result}** |
| \`get_low_margin_line_count()\` RPC (service role) | **${q8CountRpc.result}** (empty when \`can_read_intelligence()\` false) |
| UI before fix | **0** (timeout → empty \`marginAlerts.data\`) |

## Timing (service role, ${runDate})

Service role bypasses RLS; authenticated UI sessions may differ. RPCs guarded by \`can_read_intelligence()\` return empty under service role.

| Query | ms | Rows / result | Error |
| --- | ---: | --- | --- |
| Q-RPC1 \`get_workspace_counts\` | ${qRpc1.ms} | ${qRpc1.result} RPC rows | ${qRpc1.error ?? "—"} |
| Q-RPC2 \`get_campaign_financial_totals\` | ${qRpc2.ms} | ${qRpc2.result} RPC rows | ${qRpc2.error ?? "—"} |
| Q4 \`get_margin_median\` | ${qRpc4.ms} | median = ${qRpc4.result ?? "null"} | ${qRpc4.error ?? "—"} |
| Q6 \`get_top_influencers\` RPC | ${q6Rpc.ms} | ${q6Rpc.result} rows | ${q6Rpc.error ?? "—"} |
| Q7 benchmarks | ${q7.ms} | ${q7.result} rows | ${q7.error ?? "—"} |
| **Q8 old** margin alerts join | **${q8Old.ms}** | **${q8Old.result}** rows | ${q8Old.error ?? "—"} |
| **Q8a new** \`get_low_margin_line_count\` | **${q8CountRpc.ms}** | count = ${q8CountRpc.result} | ${q8CountRpc.error ?? "—"} |
| **Q8b new** \`get_margin_alerts\` | **${q8AlertsRpc.ms}** | **${q8AlertsRpc.result}** rows | ${q8AlertsRpc.error ?? "—"} |
| Full 7-query bundle (Q8 RPC) | ${bundleAfter.ms} | count=${bundleAfter.result.lowMarginCount}, alerts=${bundleAfter.result.marginAlertRows} | ${bundleAfter.result.errors.length ? bundleAfter.result.errors.join("; ") : "None"} |

## Expected UI outcome

- Amber **"[Q8] canceling statement due to statement timeout"** banner should disappear after deploy.
- **< 15% lines** KPI should show **${warehouseCount.result}** (warehouse actual), not 0.
- Margin Protection tab renders up to 40 lowest-margin alert rows (unchanged \`MarginAlertRow\` shape).
- Match % column unchanged (out of scope).
`;

  writeFileSync(docPath, header);
  console.log(`\nWrote timings to ${docPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
