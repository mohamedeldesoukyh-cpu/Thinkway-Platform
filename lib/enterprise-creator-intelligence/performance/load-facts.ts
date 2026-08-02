import type { SupabaseClient } from "@supabase/supabase-js";

import { listQuotationHistoryForInfluencer } from "@/lib/creators/quotation-price-reference";
import type {
  CreatorPerformanceFacts,
  PerformancePublicationFact,
} from "@/lib/enterprise-creator-intelligence/performance/compute";
import { isMissingTableError } from "@/lib/platform/schema-validation";

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Load performance facts from Thinkway campaign publications + IPA organic pubs.
 * Reuses quotation history for EMV benchmark input (commercial formula).
 */
export async function loadCreatorPerformanceFacts(
  supabase: SupabaseClient,
  input: {
    influencerId: string;
    platform?: string | null;
  }
): Promise<CreatorPerformanceFacts> {
  const influencerId = input.influencerId;

  let accountsQuery = supabase
    .from("influencer_platform_accounts")
    .select("platform, recent_publications")
    .eq("influencer_id", influencerId)
    .limit(20);
  if (input.platform) accountsQuery = accountsQuery.eq("platform", input.platform);

  const [accountsResult, pubsResult, quotes, assignmentsResult] = await Promise.all([
    accountsQuery,
    supabase
      .from("campaign_publications")
      .select(
        `
        platform, publication_date, views, reach, likes, comments, shares, saves,
        engagements, watch_time_seconds, completion_rate, impressions, cost, currency,
        campaign_header_id
      `
      )
      .eq("influencer_id", influencerId)
      .order("publication_date", { ascending: false })
      .limit(300),
    listQuotationHistoryForInfluencer(supabase as never, influencerId, 50).catch(() => []),
    supabase
      .from("campaign_influencers")
      .select("campaign_line_id, cost_before_vat")
      .eq("influencer_id", influencerId)
      .limit(250),
  ]);

  if (
    accountsResult.error &&
    !isMissingTableError(accountsResult.error.message, accountsResult.error.code)
  ) {
    throw new Error(accountsResult.error.message);
  }
  if (
    pubsResult.error &&
    !isMissingTableError(pubsResult.error.message, pubsResult.error.code)
  ) {
    throw new Error(pubsResult.error.message);
  }

  const publications: PerformancePublicationFact[] = [];
  let platform = input.platform ?? null;

  for (const row of (pubsResult.data ?? []) as Array<Record<string, unknown>>) {
    platform = platform ?? str(row.platform);
    publications.push({
      source: "campaign",
      platform: str(row.platform),
      postedAt: str(row.publication_date),
      views: num(row.views),
      reach: num(row.reach),
      likes: num(row.likes),
      comments: num(row.comments),
      shares: num(row.shares),
      saves: num(row.saves),
      engagements: num(row.engagements),
      watchTimeSeconds: num(row.watch_time_seconds),
      completionRate: num(row.completion_rate),
      impressions: num(row.impressions),
      cost: num(row.cost),
      currency: str(row.currency),
      campaignHeaderId: str(row.campaign_header_id),
    });
  }

  for (const account of (accountsResult.data ?? []) as Array<Record<string, unknown>>) {
    platform = platform ?? str(account.platform);
    const recent = account.recent_publications;
    if (!Array.isArray(recent)) continue;
    for (const raw of recent) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      publications.push({
        source: "organic",
        platform: str(account.platform),
        postedAt:
          str(row.posted_at) ?? str(row.timestamp) ?? str(row.createTimeISO),
        views: num(row.views) ?? num(row.videoViewCount) ?? num(row.playCount),
        reach: num(row.reach),
        likes: num(row.likes) ?? num(row.likesCount),
        comments: num(row.comments) ?? num(row.commentsCount),
        shares: num(row.shares),
        saves: num(row.saves),
        engagements: null,
        watchTimeSeconds: num(row.watch_time_seconds),
        completionRate: num(row.completion_rate),
        impressions: num(row.impressions),
        cost: null,
        currency: null,
        campaignHeaderId: null,
      });
    }
  }

  let attributedRevenue: number | null = null;
  const lineIds = [
    ...new Set(
      ((assignmentsResult.data ?? []) as Array<{ campaign_line_id: string | null }>)
        .map((r) => r.campaign_line_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (lineIds.length > 0) {
    const { data: deliverables, error } = await supabase
      .from("assignment_deliverables")
      .select("revenue_before_vat")
      .in("campaign_line_id", lineIds)
      .limit(500);
    if (!error && deliverables) {
      attributedRevenue = (
        deliverables as Array<{ revenue_before_vat: number }>
      ).reduce((sum, row) => sum + Number(row.revenue_before_vat ?? 0), 0);
    }
  }

  const avgQuotedCost =
    quotes.length > 0
      ? quotes.reduce((sum, q) => sum + Number(q.cost), 0) / quotes.length
      : null;

  return {
    influencerId,
    platform,
    publications,
    attributedRevenue,
    avgQuotedCost,
  };
}
