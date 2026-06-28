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
  CreatorEnrichmentStatus,
  CreatorSourceType,
  UnifiedCreatorBrowseFilters,
  UnifiedCreatorBrowseResult,
  UnifiedCreatorMetrics,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { passesProductionCreatorGate } from "@/lib/creators/production-filter";
import { mergeImportedStringArrays } from "@/lib/discovery-import/normalize";
import { normalizeCreatorRecentPublications } from "@/lib/creators/recent-publication-thumb";
import {
  ftsRankMap,
  searchInfluencerIdsByFts,
  searchInfluencerIdsByHandleFallback,
} from "@/lib/creators/fts-search";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";
import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type { DiscoverySearchResult, ProfileAiScore, ProfileMetricsSnapshot } from "@/lib/discovery/types";

const INTERNAL_BROWSE_LIMIT = 500;

async function resolveInternalSearchIds(
  supabase: SupabaseClient,
  search: string
): Promise<Map<string, number>> {
  const ftsHits = await searchInfluencerIdsByFts(supabase, search, 500);
  if (ftsHits.length > 0) return ftsRankMap(ftsHits);

  const fallbackHits = await searchInfluencerIdsByHandleFallback(supabase, search, 100);
  return ftsRankMap(fallbackHits);
}

/** Prefer platform account photo; fall back to linked discovery / metadata image when missing/broken. */
function resolveCreatorProfileImageUrl(
  platform: string | null | undefined,
  platformPictureUrl: string | null | undefined,
  discoveryProfileImageUrl: string | null | undefined,
  influencerAvatarUrl?: string | null | undefined
): string | null {
  return resolveBrowseCreatorProfileImageUrl({
    platform,
    platformPictureUrl,
    discoveryProfileImageUrl,
    influencerAvatarUrl,
  });
}

function metadataAvatarUrl(metadata: Record<string, unknown> | null | undefined): string | null {
  if (typeof metadata?.avatar_url === "string" && metadata.avatar_url.trim()) {
    return metadata.avatar_url.trim();
  }
  if (typeof metadata?.profile_image_url === "string" && metadata.profile_image_url.trim()) {
    return metadata.profile_image_url.trim();
  }
  return null;
}

function tagsFromImportMetadata(
  metadata: Record<string, unknown> | null | undefined
): string[] {
  return mergeImportedStringArrays(
    (metadata?.categories as string[] | undefined) ?? [],
    (metadata?.audience_interests as string[] | undefined) ?? []
  );
}

function roleFromImportMetadata(
  accountMetadata: Record<string, unknown> | null | undefined,
  influencerMetadata: Record<string, unknown> | null | undefined
): string | null {
  for (const metadata of [accountMetadata, influencerMetadata]) {
    const raw = metadata?.role ?? metadata?.creator_role;
    if (typeof raw === "string" && raw.trim()) return raw.trim();
  }
  return null;
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
    avg_likes?: number | null;
    avg_comments?: number | null;
    avg_views?: number | null;
    metrics_source?: string | null;
    sync_status?: string | null;
    metrics_is_manual_override?: boolean | null;
  } | undefined
): UnifiedCreatorMetrics {
  const metricConf = (has: boolean) =>
    resolveInternalMetricConfidence({
      metrics_source: account?.metrics_source,
      sync_status: account?.sync_status,
      is_manual_override: account?.metrics_is_manual_override ?? false,
      has_value: has,
    });

  return {
    followers: metricWithConfidence(account?.follower_count, metricConf(account?.follower_count != null)),
    engagement_rate: metricWithConfidence(
      account?.engagement_rate,
      metricConf(account?.engagement_rate != null)
    ),
    avg_likes: metricWithConfidence(account?.avg_likes, metricConf(account?.avg_likes != null)),
    avg_comments: metricWithConfidence(
      account?.avg_comments,
      metricConf(account?.avg_comments != null)
    ),
    avg_views: metricWithConfidence(account?.avg_views, metricConf(account?.avg_views != null)),
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
  const searchRankById = search ? await resolveInternalSearchIds(supabase, search) : null;

  if (search && searchRankById && searchRankById.size === 0) {
    return [];
  }

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
        "influencer_id, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, handle, profile_url, platform, metrics_source, sync_status, metrics_is_manual_override"
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

  let scopedIds: string[] | null = null;
  if (searchRankById) {
    scopedIds = [...searchRankById.keys()];
  }
  if (influencerIds) {
    scopedIds = scopedIds
      ? scopedIds.filter((id) => influencerIds.includes(id))
      : influencerIds;
  }

  let query = supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, status, country_code, categories, notes, rate_card, payment_details, thinkway_score, source_confidence, profile_id, metadata, enrichment_status, last_enriched_at, enrichment_source"
    )
    .eq("status", "active");

  if (filters.influencerId) {
    query = query.eq("id", filters.influencerId);
  } else if (!scopedIds) {
    query = query.order("updated_at", { ascending: false }).limit(INTERNAL_BROWSE_LIMIT);
  }

  if (country) query = query.eq("country_code", country);
  if (category) query = query.contains("categories", [category]);
  if (filters.language) query = query.contains("languages", [filters.language]);

  if (scopedIds) {
    if (scopedIds.length === 0) return [];
    query = query.in("id", scopedIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return [];

  const { data: linkedDiscovery } = await supabase
    .from("discovered_profiles")
    .select("id, influencer_id, profile_image_url")
    .in("influencer_id", ids);

  const profileIds = (data ?? [])
    .map((row) => (row as { profile_id?: string | null }).profile_id)
    .filter((id): id is string => Boolean(id));

  const { data: linkedProfilesById } =
    profileIds.length > 0
      ? await supabase
          .from("discovered_profiles")
          .select("id, profile_image_url")
          .in("id", profileIds)
      : { data: [] as Array<{ id: string; profile_image_url: string | null }> };

  const discoveryByInfluencer = new Map(
    (linkedDiscovery ?? []).map((r) => [r.influencer_id as string, r.id as string])
  );
  const discoveryImageByInfluencer = new Map(
    (linkedDiscovery ?? []).map((r) => [
      r.influencer_id as string,
      (r as { profile_image_url?: string | null }).profile_image_url ?? null,
    ])
  );
  const discoveryImageByProfileId = new Map(
    (linkedProfilesById ?? []).map((r) => [r.id, r.profile_image_url ?? null])
  );

  const { data: importSourceRows } = await supabase
    .from("creator_sources")
    .select("influencer_id")
    .in("influencer_id", ids);

  const importedByInfluencerId = new Set(
    (importSourceRows ?? []).map((row) => row.influencer_id as string)
  );

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, audience_country, is_verified, is_primary, profile_picture_url, profile_bio, recent_publications, metrics_source, sync_status, metrics_is_manual_override, metadata"
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
      enrichment_status?: string | null;
      last_enriched_at?: string | null;
      enrichment_source?: string | null;
      profile_id?: string | null;
      metadata?: Record<string, unknown> | null;
    };
    const platformRows = accountsByInfluencer.get(r.id) ?? [];
    const primary = platformRows[0];
    const profileBio = (primary as { profile_bio?: string | null } | undefined)?.profile_bio ?? null;
    const recentPublications = normalizeCreatorRecentPublications(
      (primary as { recent_publications?: unknown })?.recent_publications
    );
    const importTags = tagsFromImportMetadata(
      (primary?.metadata as Record<string, unknown> | null | undefined) ?? null
    );
    const role = roleFromImportMetadata(
      (primary?.metadata as Record<string, unknown> | null | undefined) ?? null,
      r.metadata ?? null
    );
    const categories = mergeImportedStringArrays(r.categories ?? [], importTags);
    const discoveryProfileImage =
      discoveryImageByInfluencer.get(r.id) ??
      (r.profile_id ? (discoveryImageByProfileId.get(r.profile_id) ?? null) : null);
    const profileImageUrl = resolveCreatorProfileImageUrl(
      primary?.platform,
      primary?.profile_picture_url,
      discoveryProfileImage,
      metadataAvatarUrl(r.metadata)
    );
    const sourceType: CreatorSourceType =
      discoveryByInfluencer.has(r.id) || importedByInfluencerId.has(r.id)
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
      bio: profileBio,
      profile_image_url: profileImageUrl,
      platforms_count: platformRows.length,
      country_code: r.country_code,
      categories,
    });

    const thinkwayScore =
      r.thinkway_score ??
      computeThinkwayScore({
        metrics,
        authenticity_score: null,
        brand_fit_score: null,
        profile_completeness: completeness,
        ai_category: categories[0] ?? null,
        ai_niche: null,
        bio: profileBio,
        profile_image_url: profileImageUrl,
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
      categories,
      language_codes: [],
      profile_image_url: profileImageUrl,
      bio: profileBio,
      role,
      metrics,
      ai_category: categories[0] ?? null,
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
        profile_picture_url: resolveCreatorProfileImageUrl(
          p.platform,
          p.profile_picture_url,
          discoveryProfileImage,
          metadataAvatarUrl(r.metadata)
        ),
      })),
      notes: r.notes,
      suggested_currency: DEFAULT_PLATFORM_CURRENCY,
      enrichment_status: (r.enrichment_status as CreatorEnrichmentStatus | null) ?? "never",
      last_enriched_at: r.last_enriched_at ?? null,
      enrichment_source: r.enrichment_source ?? null,
      recent_publications: recentPublications,
      search_rank: searchRankById?.get(r.id) ?? null,
    });
  }

  if (searchRankById) {
    results.sort(
      (a, b) =>
        (b.search_rank ?? 0) - (a.search_rank ?? 0) ||
        a.display_name.localeCompare(b.display_name)
    );
  }

  return results;
}

/** Browse rows omit publication JSONB; detail views load full creator separately. */
function stripRecentPublicationsForBrowse(
  creators: UnifiedCreatorResult[]
): UnifiedCreatorResult[] {
  return creators.map(({ recent_publications: _recentPublications, ...creator }) => creator);
}

type DiscoveryProfileRow = DiscoverySearchResult["profiles"][number];

function mapDiscoveryProfileToUnifiedResults(
  profiles: DiscoveryProfileRow[],
  filters: UnifiedCreatorBrowseFilters
): UnifiedCreatorResult[] {
  const results: UnifiedCreatorResult[] = [];

  for (const profile of profiles) {
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

    const profileImageUrl = resolveBrowseCreatorProfileImageUrl({
      platform: profile.platform,
      discoveryProfileImageUrl: profile.profile_image_url,
    });

    const completeness = profileCompletenessPercent({
      display_name: profile.display_name,
      bio: profile.bio,
      profile_image_url: profileImageUrl,
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
        profile_image_url: profileImageUrl,
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
      profile_image_url: profileImageUrl,
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
          profile_picture_url: profileImageUrl,
        },
      ],
      search_rank:
        (profile as { search_rank?: number | null }).search_rank ?? null,
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

  if (filters.discoveredProfileId) {
    const { data: profileRow, error } = await supabase
      .from("discovered_profiles")
      .select(
        `
        *,
        profile_metrics (
          followers, following, posts_count, avg_likes, avg_comments,
          engagement_rate, avg_views, posting_frequency_per_week,
          reels_views_avg, captured_at
        ),
        profile_ai_scores (
          category, niche, audience_type, content_quality_score,
          luxury_level_score, brand_fit_score, professionalism_score,
          influencer_summary, audience_persona, content_style, scored_at
        )
      `
      )
      .eq("id", filters.discoveredProfileId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profileRow) return [];
    if (profileRow.influencer_id) return [];

    const metricsRows = (profileRow.profile_metrics ?? []) as Array<
      { captured_at: string } & Record<string, unknown>
    >;
    const aiRows = (profileRow.profile_ai_scores ?? []) as Array<
      { scored_at: string } & Record<string, unknown>
    >;
    const latestMetrics =
      ([...metricsRows].sort(
        (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      )[0] as ProfileMetricsSnapshot | undefined) ?? null;
    const latestAi =
      ([...aiRows].sort(
        (a, b) => new Date(b.scored_at).getTime() - new Date(a.scored_at).getTime()
      )[0] as ProfileAiScore | undefined) ?? null;

    const { profile_metrics: _m, profile_ai_scores: _a, ...profileBase } = profileRow;
    const profile = {
      ...(profileBase as DiscoverySearchResult["profiles"][number]),
      latest_metrics: latestMetrics,
      latest_ai_score: latestAi,
    };

    return mapDiscoveryProfileToUnifiedResults([profile], filters);
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

  return mapDiscoveryProfileToUnifiedResults(discovery.profiles, filters);
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

  let merged = [...internal, ...discovery];

  if (filters.search?.trim()) {
    merged.sort(
      (a, b) =>
        (b.search_rank ?? 0) - (a.search_rank ?? 0) ||
        b.thinkway_score - a.thinkway_score
    );
  } else {
    merged.sort((a, b) => b.thinkway_score - a.thinkway_score);
  }

  if (filters.productionOnly !== false) {
    merged = merged.filter(passesProductionCreatorGate);
  }

  if (filters.platforms?.length) {
    const set = new Set(filters.platforms.map((p) => p.toLowerCase()));
    merged = merged.filter((c) =>
      c.platforms.some((p) => set.has(p.platform.toLowerCase()))
    );
  }

  const total = merged.length;
  const from = (page - 1) * pageSize;
  const creators = stripRecentPublicationsForBrowse(merged.slice(from, from + pageSize));

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
    const internal = await fetchInternalCreators(supabase, { influencerId: id });
    return internal[0] ?? null;
  }

  if (kind === "dis") {
    const { data: profileLink } = await supabase
      .from("discovered_profiles")
      .select("id, influencer_id")
      .eq("id", id)
      .maybeSingle();

    if (!profileLink) return null;
    if (profileLink.influencer_id) {
      const internal = await fetchInternalCreators(supabase, {
        influencerId: profileLink.influencer_id,
      });
      return internal[0] ?? null;
    }

    const discovery = await fetchDiscoveryCreators(supabase, { discoveredProfileId: id });
    return discovery[0] ?? null;
  }

  return null;
}

/** Back-compat helper for assignment flows */
export function toLegacySearchResult(
  creator: UnifiedCreatorResult
): import("@/lib/domains/campaign/workspace-types").InfluencerSearchResult | null {
  return unifiedToInfluencerSearch(creator);
}
