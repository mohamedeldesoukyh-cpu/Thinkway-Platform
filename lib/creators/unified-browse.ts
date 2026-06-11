import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

import { unifiedToInfluencerSearch } from "@/lib/creators/adapters";
import {
  metricWithConfidence,
  resolveDiscoveryMetricConfidence,
  resolveInternalMetricConfidence,
  averageSourceConfidence,
} from "@/lib/creators/confidence";
import {
  computeThinkwayScore,
  profileCompletenessPercent,
} from "@/lib/creators/thinkway-score";
import type {
  CreatorSourceType,
  UnifiedCreatorBrowseFilters,
  UnifiedCreatorBrowseResult,
  UnifiedCreatorMetrics,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { searchDiscoveredProfiles } from "@/lib/discovery/search";

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

function resolveInternalSourceType(account: {
  metrics_source?: string | null;
  sync_status?: string | null;
}): CreatorSourceType {
  if (account.metrics_source === "synced" && account.sync_status === "synced") {
    return "oauth_verified";
  }
  return "internal";
}

function buildInternalMetrics(
  account: {
    follower_count: number | null;
    engagement_rate: number | null;
    metrics_source?: string | null;
    sync_status?: string | null;
    metrics_is_manual_override?: boolean | null;
  } | undefined
): UnifiedCreatorMetrics {
  const followersConf = resolveInternalMetricConfidence({
    metrics_source: account?.metrics_source,
    sync_status: account?.sync_status,
    is_manual_override: account?.metrics_is_manual_override ?? false,
    has_value: account?.follower_count != null,
  });
  const engagementConf = resolveInternalMetricConfidence({
    metrics_source: account?.metrics_source,
    sync_status: account?.sync_status,
    is_manual_override: account?.metrics_is_manual_override ?? false,
    has_value: account?.engagement_rate != null,
  });

  return {
    followers: metricWithConfidence(account?.follower_count, followersConf),
    engagement_rate: metricWithConfidence(account?.engagement_rate, engagementConf),
    avg_likes: metricWithConfidence(null, "estimated"),
    avg_comments: metricWithConfidence(null, "estimated"),
    avg_views: metricWithConfidence(null, "estimated"),
    posting_frequency_per_week: metricWithConfidence(null, "estimated"),
  };
}

function buildDiscoveryMetrics(
  latest: {
    followers: number;
    engagement_rate: number | null;
    avg_likes: number | null;
    avg_comments: number | null;
    avg_views: number | null;
    posting_frequency_per_week: number | null;
  } | null,
  stage: string
): UnifiedCreatorMetrics {
  const base = (has: boolean, fromAi = false) =>
    resolveDiscoveryMetricConfidence({ stage, has_value: has, from_ai: fromAi });

  return {
    followers: metricWithConfidence(latest?.followers, base(latest != null)),
    engagement_rate: metricWithConfidence(
      latest?.engagement_rate,
      base(latest?.engagement_rate != null)
    ),
    avg_likes: metricWithConfidence(latest?.avg_likes, base(latest?.avg_likes != null)),
    avg_comments: metricWithConfidence(
      latest?.avg_comments,
      base(latest?.avg_comments != null)
    ),
    avg_views: metricWithConfidence(latest?.avg_views, base(latest?.avg_views != null)),
    posting_frequency_per_week: metricWithConfidence(
      latest?.posting_frequency_per_week,
      base(latest?.posting_frequency_per_week != null)
    ),
  };
}

async function fetchInternalCreators(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters
): Promise<UnifiedCreatorResult[]> {
  const search = filters.search?.trim() ?? "";
  const platform = filters.platform?.trim() ?? "";
  const country = filters.country?.trim().toUpperCase() ?? "";
  const category = filters.category?.trim() ?? "";

  let influencerIds: string[] | null = null;

  if (
    platform ||
    filters.minFollowers != null ||
    filters.maxFollowers != null ||
    filters.minEngagement != null
  ) {
    let accountQuery = supabase
      .from("influencer_platform_accounts")
      .select(
        "influencer_id, follower_count, engagement_rate, handle, profile_url, platform, metrics_source, sync_status, metrics_is_manual_override"
      );

    if (platform) accountQuery = accountQuery.eq("platform", platform);
    if (filters.minFollowers != null) {
      accountQuery = accountQuery.gte("follower_count", filters.minFollowers);
    }
    if (filters.maxFollowers != null) {
      accountQuery = accountQuery.lte("follower_count", filters.maxFollowers);
    }
    if (filters.minEngagement != null) {
      accountQuery = accountQuery.gte("engagement_rate", filters.minEngagement);
    }

    const { data: platformMatches, error } = await accountQuery;
    if (error) throw new Error(error.message);

    influencerIds = [...new Set(platformMatches?.map((r) => r.influencer_id) ?? [])];
    if (influencerIds.length === 0) return [];
  }

  let query = supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, status, country_code, categories, notes, rate_card, payment_details, thinkway_score, source_confidence, profile_id"
    )
    .eq("status", "active")
    .order("display_name")
    .limit(80);

  if (country) query = query.eq("country_code", country);
  if (category) query = query.contains("categories", [category]);
  if (filters.language) query = query.contains("languages", [filters.language]);

  if (search && !platform) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  if (influencerIds) query = query.in("id", influencerIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return [];

  const { data: linkedDiscovery } = await supabase
    .from("discovered_profiles")
    .select("id, influencer_id")
    .in("influencer_id", ids);

  const discoveryByInfluencer = new Map(
    (linkedDiscovery ?? []).map((r) => [r.influencer_id as string, r.id as string])
  );

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, audience_country, is_verified, is_primary, profile_picture_url, metrics_source, sync_status, metrics_is_manual_override"
    )
    .in("influencer_id", ids)
    .order("is_primary", { ascending: false });

  const accountsByInfluencer = new Map<string, NonNullable<typeof accounts>>();
  for (const account of accounts ?? []) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push(account);
    accountsByInfluencer.set(account.influencer_id, list);
  }

  const results: UnifiedCreatorResult[] = [];

  for (const row of data ?? []) {
    const r = row as {
      id: string;
      document_number: string;
      display_name: string;
      status: string;
      country_code: string | null;
      categories: string[];
      notes: string | null;
      thinkway_score: number | null;
      source_confidence: number | null;
    };
    const platformRows = accountsByInfluencer.get(r.id) ?? [];
    const primary = platformRows[0];
    const sourceType: CreatorSourceType = discoveryByInfluencer.has(r.id)
      ? "imported"
      : primary
        ? resolveInternalSourceType(primary)
        : "internal";

    if (filters.source && filters.source !== "all" && filters.source !== sourceType) {
      continue;
    }
    if (filters.verifiedOnly && !platformRows.some((p) => p.is_verified)) {
      continue;
    }

    const metrics = buildInternalMetrics(primary);
    const completeness = profileCompletenessPercent({
      display_name: r.display_name,
      bio: null,
      profile_image_url: primary?.profile_picture_url ?? null,
      platforms_count: platformRows.length,
      country_code: r.country_code,
      categories: r.categories ?? [],
    });

    const thinkwayScore =
      r.thinkway_score ??
      computeThinkwayScore({
        metrics,
        authenticity_score: null,
        brand_fit_score: null,
        profile_completeness: completeness,
        ai_category: r.categories?.[0] ?? null,
        ai_niche: null,
        bio: null,
        profile_image_url: primary?.profile_picture_url ?? null,
        platforms_count: platformRows.length,
      });

    if (filters.minThinkwayScore != null && thinkwayScore < filters.minThinkwayScore) {
      continue;
    }

    const sourceConfidence =
      r.source_confidence ?? averageSourceConfidence(Object.values(metrics));

    results.push({
      unified_id: `inf:${r.id}`,
      source_type: sourceType,
      influencer_id: r.id,
      discovered_profile_id: discoveryByInfluencer.get(r.id) ?? null,
      document_number: r.document_number,
      display_name: r.display_name,
      status: r.status,
      country_code: r.country_code,
      estimated_country: primary?.audience_country ?? r.country_code,
      city: null,
      categories: r.categories ?? [],
      language_codes: [],
      profile_image_url: primary?.profile_picture_url ?? null,
      bio: null,
      metrics,
      ai_category: r.categories?.[0] ?? null,
      ai_niche: null,
      authenticity_score: null,
      thinkway_score: thinkwayScore,
      source_confidence: sourceConfidence,
      brand_fit_score: null,
      is_platform_verified: platformRows.some((p) => p.is_verified),
      platforms: platformRows.map((p) => ({
        id: p.id,
        platform: p.platform,
        handle: p.handle,
        profile_url: p.profile_url,
        follower_count: p.follower_count,
        engagement_rate: p.engagement_rate,
        audience_country: p.audience_country,
        is_verified: p.is_verified ?? false,
        profile_picture_url: p.profile_picture_url,
      })),
      notes: r.notes,
      suggested_currency: DEFAULT_PLATFORM_CURRENCY,
    });
  }

  return results;
}

async function fetchDiscoveryCreators(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters
): Promise<UnifiedCreatorResult[]> {
  if (filters.source === "internal" || filters.source === "oauth_verified") {
    return [];
  }

  const discovery = await searchDiscoveredProfiles(supabase, {
    q: filters.search,
    platform: filters.platform as "instagram" | "tiktok" | "youtube" | "twitter" | undefined,
    country: filters.country,
    city: filters.city,
    category: filters.category,
    language: filters.language,
    minFollowers: filters.minFollowers,
    maxFollowers: filters.maxFollowers,
    minEngagement: filters.minEngagement,
    minViews: filters.minViews,
    page: 1,
    pageSize: 80,
  });

  const results: UnifiedCreatorResult[] = [];

  for (const profile of discovery.profiles) {
    if (profile.influencer_id) continue;

    const sourceType: CreatorSourceType = "public_discovery";
    if (filters.source && filters.source !== "all" && filters.source !== sourceType) {
      continue;
    }

    const metrics = buildDiscoveryMetrics(profile.latest_metrics, profile.stage);
    const ai = profile.latest_ai_score;

    if (filters.minAiScore != null) {
      const aiScore = ai?.brand_fit_score ?? ai?.content_quality_score ?? 0;
      if (aiScore < filters.minAiScore) continue;
    }

    const completeness = profileCompletenessPercent({
      display_name: profile.display_name,
      bio: profile.bio,
      profile_image_url: profile.profile_image_url,
      platforms_count: 1,
      country_code: profile.country_code,
      categories: profile.category_tags ?? [],
    });

    const thinkwayScore =
      profile.thinkway_score ??
      computeThinkwayScore({
        metrics,
        authenticity_score: profile.authenticity_score,
        brand_fit_score: ai?.brand_fit_score ?? null,
        profile_completeness: completeness,
        ai_category: ai?.category ?? profile.category_tags?.[0] ?? null,
        ai_niche: ai?.niche ?? null,
        bio: profile.bio,
        profile_image_url: profile.profile_image_url,
        platforms_count: 1,
      });

    if (filters.minThinkwayScore != null && thinkwayScore < filters.minThinkwayScore) {
      continue;
    }

    results.push({
      unified_id: `dis:${profile.id}`,
      source_type: sourceType,
      influencer_id: null,
      discovered_profile_id: profile.id,
      document_number: null,
      display_name: profile.display_name ?? profile.username,
      status: profile.stage,
      country_code: profile.country_code,
      estimated_country: profile.country_code,
      city: profile.city,
      categories: profile.category_tags ?? [],
      language_codes: profile.language_codes ?? [],
      profile_image_url: profile.profile_image_url,
      bio: profile.bio,
      metrics,
      ai_category: ai?.category ?? profile.category_tags?.[0] ?? null,
      ai_niche: ai?.niche ?? null,
      authenticity_score: profile.authenticity_score,
      thinkway_score: thinkwayScore,
      source_confidence:
        profile.source_confidence ?? averageSourceConfidence(Object.values(metrics)),
      brand_fit_score: ai?.brand_fit_score ?? null,
      is_platform_verified: false,
      platforms: [
        {
          id: profile.id,
          platform: profile.platform,
          handle: profile.username,
          profile_url: profile.profile_url,
          follower_count: profile.latest_metrics?.followers ?? null,
          engagement_rate: profile.latest_metrics?.engagement_rate ?? null,
          audience_country: profile.country_code,
          is_verified: false,
          profile_picture_url: profile.profile_image_url,
        },
      ],
    });
  }

  return results;
}

export async function browseUnifiedCreators(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters
): Promise<UnifiedCreatorBrowseResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, filters.pageSize ?? 20);

  const [internal, discovery] = await Promise.all([
    fetchInternalCreators(supabase, filters),
    fetchDiscoveryCreators(supabase, filters),
  ]);

  const merged = [...internal, ...discovery].sort(
    (a, b) => b.thinkway_score - a.thinkway_score
  );

  const total = merged.length;
  const from = (page - 1) * pageSize;
  const creators = merged.slice(from, from + pageSize);

  return {
    creators,
    total,
    page,
    pageSize,
    internal_count: internal.length,
    discovery_count: discovery.length,
  };
}

export async function getUnifiedCreatorById(
  supabase: SupabaseClient,
  unifiedId: string
): Promise<UnifiedCreatorResult | null> {
  const [kind, id] = unifiedId.split(":");
  if (!id) return null;

  if (kind === "inf") {
    const internal = await fetchInternalCreators(supabase, {});
    return internal.find((c) => c.influencer_id === id) ?? null;
  }

  if (kind === "dis") {
    const { data: profile } = await supabase
      .from("discovered_profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!profile) return null;
    const list = await fetchDiscoveryCreators(supabase, {});
    return list.find((c) => c.discovered_profile_id === id) ?? null;
  }

  return null;
}

/** Back-compat helper for assignment flows */
export function toLegacySearchResult(
  creator: UnifiedCreatorResult
): import("@/features/campaigns/types").InfluencerSearchResult | null {
  return unifiedToInfluencerSearch(creator);
}
