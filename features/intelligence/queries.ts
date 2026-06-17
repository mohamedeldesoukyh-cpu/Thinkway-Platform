import { intelligenceDb, isMissingIntelligenceTableError } from "@/lib/intelligence/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BenchmarkSliceRow,
  IntelligenceOverviewStats,
  IntelligenceTab,
  IntelligenceWorkspacePayload,
  MarginAlertRow,
  TopInfluencerIntelRow,
} from "@/types/intelligence";

function parseTab(value: string | undefined): IntelligenceTab {
  if (value === "benchmarks" || value === "margin") return value;
  return "influencers";
}

type MarginMedianRow = { median_margin_pct: number | null };
type TopInfluencerRpcRow = {
  id: string;
  display_name_raw: string;
  username: string | null;
  platform: string | null;
  country: string | null;
  tier: string | null;
  line_count: number;
  total_cost_usd: number;
  median_cost_usd: number;
  median_margin_pct: number | null;
  match_confidence: number;
};
type BenchmarkFact = {
  id: string;
  benchmark_key: string;
  period_year: number | null;
  median_cost_usd: number | null;
  median_margin_pct: number | null;
  p25_margin_pct: number | null;
  p75_margin_pct: number | null;
  sample_size: number;
  dimensions: Record<string, string | null> | null;
};
type LowMarginLineCountRow = { low_margin_line_count: number };
type MarginAlertRpcRow = {
  id: string;
  source_line_id: string;
  margin_pct: number | null;
  revenue_usd: number | null;
  cost_usd: number | null;
  market_entity: string | null;
  channel: string | null;
  period_year: number | null;
  campaign_name: string | null;
  brand_name_raw: string | null;
  influencer_name_raw: string | null;
  client_type_report: string | null;
};
type WorkspaceCountsRow = {
  campaigns: number;
  influencers: number;
  benchmarks: number;
};
type WorkspaceFinancialsRow = {
  total_revenue_usd: number;
  total_cost_usd: number;
  total_gp_usd: number;
};

function firstRpcRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function getIntelligenceWorkspace(
  tabParam?: string
): Promise<IntelligenceWorkspacePayload> {
  const tab = parseTab(tabParam);
  const warnings: string[] = [];

  try {
    const supabase = await createSupabaseServerClient();
    const db = intelligenceDb(supabase);

    const [
      workspaceCounts,
      workspaceFinancials,
      marginMedian,
      topInfluencersRpc,
      benchmarks,
      lowMarginLineCountRpc,
      marginAlertsRpc,
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

    const errors = [
      workspaceCounts.error && `[Q-RPC1] ${workspaceCounts.error.message}`,
      workspaceFinancials.error && `[Q-RPC2] ${workspaceFinancials.error.message}`,
      marginMedian.error && `[Q4] ${marginMedian.error.message}`,
      topInfluencersRpc.error && `[Q6] ${topInfluencersRpc.error.message}`,
      benchmarks.error && `[Q7] ${benchmarks.error.message}`,
      lowMarginLineCountRpc.error && `[Q8a] ${lowMarginLineCountRpc.error.message}`,
      marginAlertsRpc.error && `[Q8b] ${marginAlertsRpc.error.message}`,
    ].filter((message): message is string => Boolean(message));

    if (errors.some((message) => isMissingIntelligenceTableError(message))) {
      return emptyPayload(tab, [
        "Intelligence schema not migrated yet. Run supabase migration 20260623010000_intelligence_warehouse.sql",
      ]);
    }

    if (errors.length > 0) {
      warnings.push(...errors);
    }

    const counts = firstRpcRow(workspaceCounts.data as WorkspaceCountsRow[] | null);
    const financials = firstRpcRow(workspaceFinancials.data as WorkspaceFinancialsRow[] | null);
    const marginMedianRow = firstRpcRow(marginMedian.data as MarginMedianRow[] | null);
    const medianMarginPct =
      marginMedianRow?.median_margin_pct != null
        ? Number(marginMedianRow.median_margin_pct)
        : null;

    const totalRevenueUsd = Number(financials?.total_revenue_usd ?? 0);
    const totalCampaignLines = Number(counts?.campaigns ?? 0);
    const totalInfluencers = Number(counts?.influencers ?? 0);
    const benchmarkSliceCount = Number(counts?.benchmarks ?? 0);

    const topInfluencers: TopInfluencerIntelRow[] = (
      (topInfluencersRpc.data ?? []) as TopInfluencerRpcRow[]
    ).map((row) => ({
      id: row.id,
      display_name_raw: row.display_name_raw,
      username: row.username,
      platform: row.platform,
      country: row.country,
      tier: row.tier,
      line_count: Number(row.line_count ?? 0),
      total_cost_usd: Number(row.total_cost_usd ?? 0),
      median_cost_usd: Number(row.median_cost_usd ?? 0),
      median_margin_pct:
        row.median_margin_pct != null ? Number(row.median_margin_pct) : null,
      match_confidence: Number(row.match_confidence ?? 0),
    }));

    const lowMarginLineCountRow = firstRpcRow(
      lowMarginLineCountRpc.data as LowMarginLineCountRow[] | null
    );
    const lowMarginLineCount = Number(lowMarginLineCountRow?.low_margin_line_count ?? 0);

    const stats: IntelligenceOverviewStats = {
      totalCampaignLines,
      totalInfluencers,
      totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
      medianMarginPct,
      lowMarginLineCount,
      benchmarkSliceCount,
      dataAvailable:
        totalCampaignLines > 0 ||
        totalInfluencers > 0 ||
        benchmarkSliceCount > 0 ||
        topInfluencers.length > 0 ||
        totalRevenueUsd > 0,
    };

    const benchmarkRows: BenchmarkSliceRow[] = ((benchmarks.data ?? []) as unknown as BenchmarkFact[]).map(
      (row) => {
      const dims = row.dimensions ?? {};
      return {
        id: row.id,
        benchmark_key: row.benchmark_key,
        period_year: row.period_year,
        platform: dims.platform ?? null,
        category: dims.category ?? null,
        market_entity: dims.market_entity ?? null,
        tier: dims.tier ?? null,
        median_cost_usd: row.median_cost_usd != null ? Number(row.median_cost_usd) : null,
        median_margin_pct: row.median_margin_pct != null ? Number(row.median_margin_pct) : null,
        p25_margin_pct: row.p25_margin_pct != null ? Number(row.p25_margin_pct) : null,
        p75_margin_pct: row.p75_margin_pct != null ? Number(row.p75_margin_pct) : null,
        sample_size: Number(row.sample_size ?? 0),
      };
    }
    );

    const marginAlertRows: MarginAlertRow[] = (
      (marginAlertsRpc.data ?? []) as MarginAlertRpcRow[]
    ).map((row) => ({
      id: row.id,
      source_line_id: row.source_line_id,
      campaign_name: row.campaign_name,
      brand_name_raw: row.brand_name_raw,
      influencer_name_raw: row.influencer_name_raw,
      margin_pct: row.margin_pct != null ? Number(row.margin_pct) : null,
      revenue_usd: row.revenue_usd != null ? Number(row.revenue_usd) : null,
      cost_usd: row.cost_usd != null ? Number(row.cost_usd) : null,
      market_entity: row.market_entity,
      channel: row.channel,
      period_year: row.period_year,
      client_type_report: row.client_type_report,
    }));

    return {
      tab,
      stats,
      topInfluencers,
      benchmarks: benchmarkRows,
      marginAlerts: marginAlertRows,
      warnings,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Intelligence query failed";
    return emptyPayload(tab, [message]);
  }
}

function emptyPayload(tab: IntelligenceTab, warnings: string[]): IntelligenceWorkspacePayload {
  return {
    tab,
    stats: {
      totalCampaignLines: 0,
      totalInfluencers: 0,
      totalRevenueUsd: 0,
      medianMarginPct: null,
      lowMarginLineCount: 0,
      benchmarkSliceCount: 0,
      dataAvailable: false,
    },
    topInfluencers: [],
    benchmarks: [],
    marginAlerts: [],
    warnings,
  };
}
