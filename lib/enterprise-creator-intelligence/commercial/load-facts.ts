import type { SupabaseClient } from "@supabase/supabase-js";

import { listQuotationHistoryForInfluencer } from "@/lib/creators/quotation-price-reference";
import { loadCreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/load-monthly";
import type { CreatorCommercialFacts } from "@/lib/enterprise-creator-intelligence/commercial/compute";
import { isMissingTableError } from "@/lib/platform/schema-validation";

/**
 * Load Thinkway commercial + performance + Sprint 1 historical facts for a creator.
 * Does not reimplement CPM/CPE engines — only gathers inputs.
 */
export async function loadCreatorCommercialFacts(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
  }
): Promise<CreatorCommercialFacts> {
  const influencerId = input.influencerId;

  const [pubsResult, assignmentsResult, quotes, monthly] = await Promise.all([
    supabase
      .from("campaign_publications")
      .select(
        `
        cost, currency, impressions, views, reach, forecast_reach,
        likes, comments, shares, saves, engagements,
        publication_date, campaign_header_id
      `
      )
      .eq("influencer_id", influencerId)
      .order("publication_date", { ascending: false })
      .limit(250),
    supabase
      .from("campaign_influencers")
      .select(
        `
        cost_before_vat, currency, deliverable_count,
        campaign_header_id, campaign_line_id
      `
      )
      .eq("influencer_id", influencerId)
      .limit(250),
    listQuotationHistoryForInfluencer(supabase as never, influencerId, 50).catch(
      () => []
    ),
    loadCreatorMonthlyMetrics(supabase, {
      influencerId,
      platform: input.platform,
      limitMonths: 36,
    }),
  ]);

  if (pubsResult.error && !isMissingTableError(pubsResult.error.message, pubsResult.error.code)) {
    throw new Error(pubsResult.error.message);
  }
  if (
    assignmentsResult.error &&
    !isMissingTableError(assignmentsResult.error.message, assignmentsResult.error.code)
  ) {
    throw new Error(assignmentsResult.error.message);
  }

  const publications = ((pubsResult.data ?? []) as Array<Record<string, unknown>>).map(
    (row) => ({
      cost: row.cost == null ? null : Number(row.cost),
      currency: (row.currency as string | null) ?? null,
      impressions: row.impressions == null ? null : Number(row.impressions),
      views: row.views == null ? null : Number(row.views),
      reach: row.reach == null ? null : Number(row.reach),
      forecastReach:
        row.forecast_reach == null ? null : Number(row.forecast_reach),
      likes: row.likes == null ? null : Number(row.likes),
      comments: row.comments == null ? null : Number(row.comments),
      shares: row.shares == null ? null : Number(row.shares),
      saves: row.saves == null ? null : Number(row.saves),
      engagements: row.engagements == null ? null : Number(row.engagements),
      publishedAt: (row.publication_date as string | null) ?? null,
      campaignHeaderId: (row.campaign_header_id as string | null) ?? null,
    })
  );

  const assignments = (
    (assignmentsResult.data ?? []) as Array<Record<string, unknown>>
  ).map((row) => ({
    costBeforeVat:
      row.cost_before_vat == null ? null : Number(row.cost_before_vat),
    currency: (row.currency as string | null) ?? null,
    deliverableCount:
      row.deliverable_count == null ? null : Number(row.deliverable_count),
    campaignHeaderId: (row.campaign_header_id as string | null) ?? null,
    campaignLineId: (row.campaign_line_id as string | null) ?? null,
  }));

  const lineIds = [
    ...new Set(
      assignments
        .map((a) => a.campaignLineId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  let attributedRevenue: number | null = null;
  let revenueCurrency: string | null = null;

  if (lineIds.length > 0) {
    const { data: deliverables, error: delError } = await supabase
      .from("assignment_deliverables")
      .select("revenue_before_vat, campaign_line_id")
      .in("campaign_line_id", lineIds)
      .limit(500);

    if (delError && !isMissingTableError(delError.message, delError.code)) {
      throw new Error(delError.message);
    }

    if (deliverables && deliverables.length > 0) {
      attributedRevenue = (deliverables as Array<{ revenue_before_vat: number }>).reduce(
        (sum, row) => sum + Number(row.revenue_before_vat ?? 0),
        0
      );
      // Deliverables inherit campaign currency via lines; use assignment currency when present.
      revenueCurrency =
        assignments.find((a) => a.currency)?.currency?.toUpperCase() ?? null;
    }
  }

  const historicalMonths = monthly.months.map((m) => ({
    avgViews: m.avgViews,
    medianViews: m.medianViews,
    periodMonth: m.periodMonth,
    platform: m.platform,
  }));

  return {
    influencerId,
    platform: input.platform ?? monthly.platform,
    publications,
    assignments,
    attributedRevenue,
    revenueCurrency,
    quotes: quotes.map((q) => ({
      cost: q.cost,
      currency: q.cost_currency,
      quotedAt: q.quoted_at,
    })),
    historicalMonths,
  };
}
