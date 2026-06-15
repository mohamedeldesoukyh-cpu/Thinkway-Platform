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

type RevenueFact = { revenue_usd: number | null };
type MarginFact = { margin_pct: number | null };
type InfluencerCampaignJoin = {
  int_influencer_id: string | null;
  cost_usd: number | null;
  margin_pct: number | null;
  int_influencers: {
    display_name_raw: string;
    username: string | null;
    platform: string | null;
    country: string | null;
    tier: string | null;
    match_confidence: number;
  } | null;
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
type MarginAlertJoin = {
  id: string;
  source_line_id: string;
  margin_pct: number | null;
  revenue_usd: number | null;
  cost_usd: number | null;
  market_entity: string | null;
  channel: string | null;
  period_year: number | null;
  int_campaigns: {
    campaign_name: string | null;
    brand_name_raw: string | null;
    influencer_name_raw: string | null;
    client_type_report: string | null;
  } | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100
    : sorted[mid];
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
      campaignCount,
      influencerCount,
      revenueRows,
      marginRows,
      benchmarkCount,
      topInfluencerCampaigns,
      benchmarks,
      marginAlerts,
    ] = await Promise.all([
      db.from("int_campaigns").select("id", { count: "exact", head: true }),
      db.from("int_influencers").select("id", { count: "exact", head: true }),
      db.from("int_campaigns").select("revenue_usd").not("revenue_usd", "is", null).limit(5000),
      db.from("int_margin_history").select("margin_pct").not("margin_pct", "is", null).limit(5000),
      db.from("int_benchmarks").select("id", { count: "exact", head: true }),
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
      campaignCount.error,
      influencerCount.error,
      revenueRows.error,
      marginRows.error,
      benchmarkCount.error,
      topInfluencerCampaigns.error,
      benchmarks.error,
      marginAlerts.error,
    ].filter(Boolean);

    if (errors.some((e) => isMissingIntelligenceTableError(e?.message))) {
      return emptyPayload(tab, [
        "Intelligence schema not migrated yet. Run supabase migration 20260623010000_intelligence_warehouse.sql",
      ]);
    }

    if (errors.length > 0) {
      warnings.push(...errors.map((e) => e?.message ?? "Unknown query error"));
    }

    const totalRevenueUsd = ((revenueRows.data ?? []) as RevenueFact[]).reduce(
      (sum, row) => sum + Number(row.revenue_usd ?? 0),
      0
    );
    const marginValues = ((marginRows.data ?? []) as MarginFact[])
      .map((row) => Number(row.margin_pct))
      .filter((v) => Number.isFinite(v));

    const stats: IntelligenceOverviewStats = {
      totalCampaignLines: campaignCount.count ?? 0,
      totalInfluencers: influencerCount.count ?? 0,
      totalRevenueUsd: Math.round(totalRevenueUsd * 100) / 100,
      medianMarginPct: median(marginValues),
      lowMarginLineCount: marginAlerts.data?.length ?? 0,
      benchmarkSliceCount: benchmarkCount.count ?? 0,
      dataAvailable: (campaignCount.count ?? 0) > 0,
    };

    const influencerAgg = new Map<
      string,
      {
        row: TopInfluencerIntelRow;
        costs: number[];
        margins: number[];
      }
    >();

    for (const row of (topInfluencerCampaigns.data ?? []) as InfluencerCampaignJoin[]) {
      const infId = row.int_influencer_id;
      const inf = row.int_influencers;
      if (!infId || !inf) continue;

      const bucket = influencerAgg.get(infId) ?? {
        row: {
          id: infId,
          display_name_raw: inf.display_name_raw,
          username: inf.username,
          platform: inf.platform,
          country: inf.country,
          tier: inf.tier,
          line_count: 0,
          total_cost_usd: 0,
          median_cost_usd: 0,
          median_margin_pct: null,
          match_confidence: Number(inf.match_confidence ?? 0),
        },
        costs: [],
        margins: [],
      };

      bucket.row.line_count += 1;
      const cost = Number(row.cost_usd ?? 0);
      if (cost > 0) {
        bucket.costs.push(cost);
        bucket.row.total_cost_usd += cost;
      }
      if (row.margin_pct != null) bucket.margins.push(Number(row.margin_pct));
      influencerAgg.set(infId, bucket);
    }

    const topInfluencers: TopInfluencerIntelRow[] = [...influencerAgg.values()]
      .map(({ row, costs, margins }) => ({
        ...row,
        total_cost_usd: Math.round(row.total_cost_usd * 100) / 100,
        median_cost_usd: median(costs) ?? 0,
        median_margin_pct: median(margins),
      }))
      .sort((a, b) => b.line_count - a.line_count)
      .slice(0, 25);

    const benchmarkRows: BenchmarkSliceRow[] = ((benchmarks.data ?? []) as BenchmarkFact[]).map(
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

    const marginAlertRows: MarginAlertRow[] = ((marginAlerts.data ?? []) as MarginAlertJoin[]).map(
      (row) => {
      const campaign = row.int_campaigns;
      return {
        id: row.id,
        source_line_id: row.source_line_id,
        campaign_name: campaign?.campaign_name ?? null,
        brand_name_raw: campaign?.brand_name_raw ?? null,
        influencer_name_raw: campaign?.influencer_name_raw ?? null,
        margin_pct: row.margin_pct != null ? Number(row.margin_pct) : null,
        revenue_usd: row.revenue_usd != null ? Number(row.revenue_usd) : null,
        cost_usd: row.cost_usd != null ? Number(row.cost_usd) : null,
        market_entity: row.market_entity,
        channel: row.channel,
        period_year: row.period_year,
        client_type_report: campaign?.client_type_report ?? null,
      };
    }
    );

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
