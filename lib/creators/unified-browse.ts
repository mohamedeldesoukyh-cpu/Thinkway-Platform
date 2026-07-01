import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

import {
  applyCategoriesToArrayColumnQuery,
  creatorMatchesBrowseCategories,
  resolveBrowseCategories,
  shouldUseUnifiedBrowseIndexPath,
} from "@/lib/creators/category-filter";
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
import { resolveAggregatedCreatorEnrichmentStatus } from "@/lib/creator-enrichment/status-resolution";
import { passesProductionCreatorGate } from "@/lib/creators/production-filter";
import {
  findPlatformAccountById,
  mergeCreatorInterestTags,
  resolveCreatorPrimaryAvatar,
  resolveDefaultMetricsPlatformAccountId,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import { mergeImportedStringArrays } from "@/lib/discovery-import/normalize";
import { normalizeCreatorRecentPublications } from "@/lib/creators/recent-publication-thumb";
import { createDiscoverySearchPerf } from "@/lib/creators/discovery-search-perf";
import {
  creatorSearchHasMore,
  searchCreators,
  searchInfluencerIdsByHandleFallback,
  type CreatorSearchHit,
} from "@/lib/creators/fts-search";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";
import { normalizeDiscoverySearchQuery } from "@/lib/discovery/creator-search-query";
import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type { DiscoverySearchResult, ProfileAiScore, ProfileMetricsSnapshot } from "@/lib/discovery/types";

/** Default discovery browse/search catalog — excludes draft prospects. */
export const BROWSE_INFLUENCER_STATUSES = ["active"] as const;

/** Direct id/ref resolution — includes prospects added via Discovery URL flow. */
export const RESOLVABLE_INFLUENCER_STATUSES = [
  "active",
  "prospect",
  "inactive",
] as const;

export function isExplicitInfluencerLookup(
  filters: Pick<UnifiedCreatorBrowseFilters, "influencerId">,
  scopedInfluencerIds?: string[] | null
): boolean {
  return Boolean(
    filters.influencerId ||
      (scopedInfluencerIds != null && scopedInfluencerIds.length > 0)
  );
}

function unifiedIdFromSearchHit(hit: CreatorSearchHit): string {
  return hit.source_type === "influencer"
    ? `inf:${hit.creator_id}`
    : `dis:${hit.creator_id}`;
}

function influencerRankMapFromHits(hits: CreatorSearchHit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const hit of hits) {
    if (hit.source_type !== "influencer") continue;
    map.set(hit.creator_id, hit.rank);
  }
  return map;
}

function mergeCreatorsInSearchOrder(
  hits: CreatorSearchHit[],
  internal: UnifiedCreatorResult[],
  discovery: UnifiedCreatorResult[]
): UnifiedCreatorResult[] {
  const byUnifiedId = new Map<string, UnifiedCreatorResult>();
  for (const creator of internal) byUnifiedId.set(creator.unified_id, creator);
  for (const creator of discovery) byUnifiedId.set(creator.unified_id, creator);

  const ordered: UnifiedCreatorResult[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    const unifiedId = unifiedIdFromSearchHit(hit);
    if (seen.has(unifiedId)) continue;
    const creator = byUnifiedId.get(unifiedId);
    if (!creator) continue;
    seen.add(unifiedId);
    ordered.push({ ...creator, search_rank: hit.rank });
  }
  return ordered;
}

/** Drop unlinked discovery rows when an imported influencer already owns the same handle. */
function dedupeSearchResultsByHandle(
  creators: UnifiedCreatorResult[]
): UnifiedCreatorResult[] {
  const internalHandles = new Set<string>();
  for (const creator of creators) {
    if (!creator.influencer_id) continue;
    for (const platform of creator.platforms) {
      const handle = platform.handle?.replace(/^@+/, "").trim().toLowerCase();
      if (handle) internalHandles.add(handle);
    }
  }

  if (internalHandles.size === 0) return creators;

  return creators.filter((creator) => {
    if (creator.influencer_id) return true;
    const handle = creator.platforms[0]?.handle?.replace(/^@+/, "").trim().toLowerCase();
    if (!handle) return true;
    return !internalHandles.has(handle);
  });
}

type CategoryBrowseIdRow = {
  id: string;
  total_count: number | string | null;
};

async function queryInfluencerIdsForCategoryBrowse(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  page: number,
  pageSize: number
): Promise<{ ids: string[]; total: number }> {
  const categories = resolveBrowseCategories(filters);
  const country = filters.country?.trim() ?? null;
  const language = filters.language?.trim() ?? null;
  const from = (page - 1) * pageSize;

  const { data, error } = await supabase.rpc("browse_influencer_ids_for_categories", {
    p_categories: categories,
    p_country: country,
    p_language: language,
    p_limit: pageSize,
    p_offset: from,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as CategoryBrowseIdRow[];
  const ids = rows.map((row) => row.id).filter(Boolean);
  const total = Number(rows[0]?.total_count ?? 0);
  return { ids, total };
}

async function fetchInternalCreatorsBrowsePage(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  page: number,
  pageSize: number
): Promise<UnifiedCreatorResult[]> {
  const categories = resolveBrowseCategories(filters);
  let ids: string[] = [];

  if (categories.length > 0) {
    const browse = await queryInfluencerIdsForCategoryBrowse(supabase, filters, page, pageSize);
    ids = browse.ids;
  } else {
    let idQuery = supabase.from("influencers").select("id").eq("status", "active");

    const country = filters.country?.trim().toUpperCase() ?? "";
    if (country) idQuery = idQuery.eq("country_code", country);
    if (filters.language) idQuery = idQuery.contains("languages", [filters.language]);

    const from = (page - 1) * pageSize;
    const { data, error } = await idQuery
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    ids = (data ?? []).map((row) => row.id as string);
  }

  if (ids.length === 0) return [];

  const results = await fetchInternalCreators(
    supabase,
    { ...filters, search: undefined, page: undefined, pageSize: undefined },
    ids,
    null,
    { omitHeavyFields: true }
  );

  const order = new Map(ids.map((id, index) => [id, index]));
  results.sort(
    (a, b) =>
      (order.get(a.influencer_id ?? "") ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.influencer_id ?? "") ?? Number.MAX_SAFE_INTEGER)
  );
  return results;
}

async function countInternalCreatorsBrowse(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters
): Promise<number> {
  const categories = resolveBrowseCategories(filters);
  if (categories.length > 0) {
    const browse = await queryInfluencerIdsForCategoryBrowse(supabase, filters, 1, 1);
    return browse.total;
  }

  let countQuery = supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  const country = filters.country?.trim().toUpperCase() ?? "";
  if (country) countQuery = countQuery.eq("country_code", country);
  if (filters.language) countQuery = countQuery.contains("languages", [filters.language]);

  const { count, error } = await countQuery;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function applyPostBrowseFilters(
  merged: UnifiedCreatorResult[],
  filters: UnifiedCreatorBrowseFilters
): UnifiedCreatorResult[] {
  let results = merged;
  if (filters.productionOnly !== false) {
    results = results.filter(passesProductionCreatorGate);
  }
  const categories = resolveBrowseCategories(filters);
  if (categories.length > 0) {
    results = results.filter((creator) => creatorMatchesBrowseCategories(creator, categories));
  }
  if (filters.platforms?.length) {
    const set = new Set(filters.platforms.map((p) => p.toLowerCase()));
    results = results.filter((c) =>
      c.platforms.some((p) => set.has(p.platform.toLowerCase()))
    );
  }
  return results;
}

/** Prefer platform account photo; fall back through avatar_url chain when missing/broken. */
function resolveCreatorProfileImageUrl(
  platform: string | null | undefined,
  platformPictureUrl: string | null | undefined,
  platformAvatarUrl: string | null | undefined,
  discoveryProfileImageUrl: string | null | undefined,
  influencerAvatarUrl?: string | null | undefined,
  logContext?: { handle?: string | null }
): string | null {
  const resolved = resolveBrowseCreatorProfileImageUrl({
    platform,
    platformPictureUrl,
    platformAvatarUrl,
    discoveryProfileImageUrl,
    influencerAvatarUrl,
  });

  return resolved;
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
  filters: UnifiedCreatorBrowseFilters,
  scopedInfluencerIds?: string[],
  searchRankById?: Map<string, number> | null,
  options?: { omitHeavyFields?: boolean }
): Promise<UnifiedCreatorResult[]> {
  const search = filters.search?.trim() ?? "";
  const platform = filters.platform?.trim() ?? "";
  const country = filters.country?.trim().toUpperCase() ?? "";
  const categories = resolveBrowseCategories(filters);
  const resolvedSearchRankById = searchRankById ?? null;
  const omitHeavyFields = options?.omitHeavyFields ?? false;

  if (search && scopedInfluencerIds && scopedInfluencerIds.length === 0) {
    return [];
  }

  const candidateIds =
    scopedInfluencerIds ??
    (resolvedSearchRankById ? [...resolvedSearchRankById.keys()] : null);

  let influencerIds: string[] | null = candidateIds;

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

    if (candidateIds?.length) {
      accountQuery = accountQuery.in("influencer_id", candidateIds);
    }

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

    const platformScopedIds = [...new Set(platformMatches?.map((r) => r.influencer_id) ?? [])];
    if (platformScopedIds.length === 0) return [];
    influencerIds = influencerIds
      ? influencerIds.filter((id) => platformScopedIds.includes(id))
      : platformScopedIds;
    if (influencerIds.length === 0) return [];
  }

  let scopedIds: string[] | null = null;
  if (resolvedSearchRankById) {
    scopedIds = [...resolvedSearchRankById.keys()];
  }
  if (influencerIds) {
    scopedIds = scopedIds
      ? scopedIds.filter((id) => influencerIds!.includes(id))
      : influencerIds;
  }

  const explicitLookup = isExplicitInfluencerLookup(filters, scopedIds);

  let query = supabase
    .from("influencers")
    .select(
      "id, document_number, display_name, status, country_code, categories, notes, rate_card, payment_details, thinkway_score, source_confidence, profile_id, metadata, enrichment_status, last_enriched_at, enrichment_source, primary_avatar_url, primary_avatar_source, default_metrics_platform_account_id"
    );

  query = explicitLookup
    ? query.in("status", [...RESOLVABLE_INFLUENCER_STATUSES])
    : query.in("status", [...BROWSE_INFLUENCER_STATUSES]);

  if (filters.influencerId) {
    query = query.eq("id", filters.influencerId);
  } else if (!scopedIds) {
    return [];
  }

  if (country) query = query.eq("country_code", country);
  if (categories.length > 0 && !scopedIds) {
    query = applyCategoriesToArrayColumnQuery(query, "categories", categories);
  }
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

  const accountsResult = omitHeavyFields
    ? await supabase
        .from("influencer_platform_accounts")
        .select(
          "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, audience_country, is_verified, is_primary, profile_picture_url, profile_bio, metrics_source, sync_status, metrics_is_manual_override, metadata, avatar_source, interest_categories, enrichment_status"
        )
        .in("influencer_id", ids)
    : await supabase
        .from("influencer_platform_accounts")
        .select(
          "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, audience_country, is_verified, is_primary, profile_picture_url, profile_bio, recent_publications, metrics_source, sync_status, metrics_is_manual_override, metadata, avatar_source, interest_categories, enrichment_status"
        )
        .in("influencer_id", ids);
  const { data: accounts } = accountsResult;

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
      primary_avatar_url?: string | null;
      primary_avatar_source?: string | null;
      default_metrics_platform_account_id?: string | null;
    };
    const platformRows = sortPlatformsStable(accountsByInfluencer.get(r.id) ?? []);
    const defaultMetricsAccountId = resolveDefaultMetricsPlatformAccountId(
      platformRows,
      r.default_metrics_platform_account_id
    );
    const metricsAccount =
      findPlatformAccountById(platformRows, defaultMetricsAccountId) ?? platformRows[0];
    const profileBio =
      (metricsAccount as { profile_bio?: string | null } | undefined)?.profile_bio ?? null;
    const recentPublications = normalizeCreatorRecentPublications(
      (metricsAccount as { recent_publications?: unknown })?.recent_publications
    );
    const importTags = tagsFromImportMetadata(
      (metricsAccount?.metadata as Record<string, unknown> | null | undefined) ?? null
    );
    const role = roleFromImportMetadata(
      (metricsAccount?.metadata as Record<string, unknown> | null | undefined) ?? null,
      r.metadata ?? null
    );
    const storedCategoryTags = [...(r.categories ?? [])];
    const audienceInterests = mergeCreatorInterestTags({
      influencerCategories: [],
      accounts: platformRows,
    });
    const categories = mergeImportedStringArrays(storedCategoryTags, importTags);
    const discoveryProfileImage =
      discoveryImageByInfluencer.get(r.id) ??
      (r.profile_id ? (discoveryImageByProfileId.get(r.profile_id) ?? null) : null);
    const avatarInput = {
      storedPrimaryAvatarUrl: r.primary_avatar_url,
      storedPrimaryAvatarSource: r.primary_avatar_source,
      influencerMetadata: r.metadata ?? null,
      discoveryProfileImageUrl: discoveryProfileImage,
      accounts: platformRows.map((p) => ({
        id: p.id,
        platform: p.platform,
        profile_picture_url: p.profile_picture_url,
        avatar_source: (p as { avatar_source?: string | null }).avatar_source,
        metadata: (p.metadata as Record<string, unknown> | null | undefined) ?? null,
      })),
    };
    const avatarResolved = resolveCreatorPrimaryAvatar(avatarInput);
    const profileImageUrl = avatarResolved.url;

    const sourceType: CreatorSourceType =
      discoveryByInfluencer.has(r.id) || importedByInfluencerId.has(r.id)
        ? "imported"
        : metricsAccount
          ? resolveInternalSourceType(metricsAccount)
          : "internal";

    if (filters.source && filters.source !== "all" && filters.source !== sourceType) {
      continue;
    }
    if (filters.verifiedOnly && !platformRows.some((p) => p.is_verified)) {
      continue;
    }

    const metrics = buildInternalMetrics(metricsAccount);
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
      estimated_country: metricsAccount?.audience_country ?? r.country_code,
      city: null,
      categories,
      browse_category_tags: storedCategoryTags,
      audience_interests: audienceInterests,
      language_codes: [],
      profile_image_url: profileImageUrl,
      primaryAvatarUrl: profileImageUrl,
      primaryAvatarSource: avatarResolved.source,
      default_metrics_platform_account_id: defaultMetricsAccountId,
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
        avg_likes: p.avg_likes,
        avg_comments: p.avg_comments,
        avg_views: p.avg_views,
        audience_country: p.audience_country,
        is_verified: p.is_verified ?? false,
        profile_picture_url: resolveCreatorProfileImageUrl(
          p.platform,
          p.profile_picture_url,
          metadataAvatarUrl(
            (p.metadata as Record<string, unknown> | null | undefined) ?? null
          ),
          discoveryProfileImage,
          metadataAvatarUrl(r.metadata)
        ),
        profile_bio: (p as { profile_bio?: string | null }).profile_bio ?? null,
        recent_publications: normalizeCreatorRecentPublications(
          (p as { recent_publications?: unknown }).recent_publications
        ),
      })),
      notes: r.notes,
      suggested_currency: DEFAULT_PLATFORM_CURRENCY,
      enrichment_status: resolveAggregatedCreatorEnrichmentStatus({
        creatorId: r.id,
        storedStatus: (r.enrichment_status as CreatorEnrichmentStatus | null) ?? "never",
        platformStatuses: platformRows.map(
          (p) => (p as { enrichment_status?: CreatorEnrichmentStatus | null }).enrichment_status
        ),
        hasInflightJob: false,
      }),
      last_enriched_at: r.last_enriched_at ?? null,
      enrichment_source: r.enrichment_source ?? null,
      recent_publications: recentPublications,
      search_rank: resolvedSearchRankById?.get(r.id) ?? null,
    });
  }

  if (resolvedSearchRankById) {
    results.sort(
      (a, b) =>
        (b.search_rank ?? 0) - (a.search_rank ?? 0) ||
        a.display_name.localeCompare(b.display_name)
    );
  }

  if (categories.length > 0 && scopedIds) {
    return results.filter((creator) => creatorMatchesBrowseCategories(creator, categories));
  }

  return results;
}

type CreatorSearchHitsResult = {
  hits: CreatorSearchHit[];
  totalCount?: number;
};

async function resolveCreatorSearchHits(
  supabase: SupabaseClient,
  search: string,
  pageSize: number,
  offset: number
): Promise<CreatorSearchHitsResult> {
  let response = await searchCreators(supabase, search, pageSize, offset);
  if (response.hits.length > 0 || !search) return response;

  const normalizedQuery = normalizeDiscoverySearchQuery(search);
  if (normalizedQuery && normalizedQuery !== search.trim()) {
    response = await searchCreators(supabase, normalizedQuery, pageSize, offset);
    if (response.hits.length > 0) return response;
  }

  const fallbackIds = await searchInfluencerIdsByHandleFallback(
    supabase,
    normalizedQuery || search,
    pageSize
  );
  if (fallbackIds.length === 0) return { hits: [], totalCount: 0 };

  return {
    hits: fallbackIds.map((hit) => ({
      source_type: "influencer" as const,
      creator_id: hit.id,
      rank: hit.rank,
      has_more: false,
    })),
    totalCount: fallbackIds.length,
  };
}

/** Browse rows omit publication JSONB; detail views load full creator separately. */
function stripRecentPublicationsForBrowse(
  creators: UnifiedCreatorResult[]
): UnifiedCreatorResult[] {
  return creators.map(({ recent_publications: _recentPublications, platforms, ...creator }) => ({
    ...creator,
    platforms: platforms.map(({ recent_publications: _pubs, ...platform }) => platform),
  }));
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
    const primaryAvatarSource = profileImageUrl ? ("opengraph" as const) : ("placeholder" as const);

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
      browse_category_tags: profile.category_tags ?? [],
      language_codes: profile.language_codes ?? [],
      profile_image_url: profileImageUrl,
      primaryAvatarUrl: profileImageUrl,
      primaryAvatarSource,
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
  filters: UnifiedCreatorBrowseFilters,
  scopedDiscoveredProfileIds?: string[]
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
    categories: resolveBrowseCategories(filters),
    language: filters.language,
    minFollowers: filters.minFollowers,
    maxFollowers: filters.maxFollowers,
    minEngagement: filters.minEngagement,
    minViews: filters.minViews,
    page: 1,
    pageSize: scopedDiscoveredProfileIds?.length ?? 80,
    profileIds: scopedDiscoveredProfileIds,
  });

  return mapDiscoveryProfileToUnifiedResults(discovery.profiles, filters);
}

export async function browseUnifiedCreators(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters
): Promise<UnifiedCreatorBrowseResult> {
  const perf = createDiscoverySearchPerf("browseUnifiedCreators");

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, filters.pageSize ?? 20);
  const search = filters.search?.trim() ?? "";
  const sourceFilter = filters.source ?? "all";
  const browseHydrationOptions = { omitHeavyFields: true };

  if (filters.influencerId || filters.discoveredProfileId) {
    perf?.span("fetchInternalCreators");
    const internalPromise = fetchInternalCreators(supabase, filters);
    perf?.span("fetchDiscoveryCreators");
    const discoveryPromise = fetchDiscoveryCreators(supabase, filters);
    const [internal, discovery] = await Promise.all([internalPromise, discoveryPromise]);
    perf?.span("merge");
    let merged = [...internal, ...discovery];
    if (filters.productionOnly !== false) {
      merged = merged.filter(passesProductionCreatorGate);
    }
    perf?.span("serialization");
    const result = {
      creators: stripRecentPublicationsForBrowse(merged),
      total: merged.length,
      page: 1,
      pageSize: merged.length,
      internal_count: internal.length,
      discovery_count: discovery.length,
    };
    perf?.end();
    return result;
  }

  if (!search) {
    const includeInternal = sourceFilter === "all" || sourceFilter === "internal" || sourceFilter === "imported" || sourceFilter === "oauth_verified";
    const includeDiscovery = sourceFilter === "all" || sourceFilter === "public_discovery" || sourceFilter === "imported";
    const categoryFilterActive = resolveBrowseCategories(filters).length > 0;

    if (categoryFilterActive && includeInternal) {
      perf?.span("fetchInternalCreators");
      const internalPromise = fetchInternalCreatorsBrowsePage(supabase, filters, page, pageSize);
      perf?.span("search_creators_count");
      const totalPromise = countInternalCreatorsBrowse(supabase, filters);
      const [internal, totalMatches] = await Promise.all([internalPromise, totalPromise]);

      perf?.span("merge");
      let merged = applyPostBrowseFilters(internal, filters);
      const offset = (page - 1) * pageSize;

      perf?.span("serialization");
      const result = {
        creators: stripRecentPublicationsForBrowse(merged),
        total: totalMatches,
        has_more: offset + merged.length < totalMatches,
        page,
        pageSize,
        internal_count: merged.length,
        discovery_count: 0,
      };
      perf?.end();
      return result;
    }

    if (includeInternal && includeDiscovery && shouldUseUnifiedBrowseIndexPath(filters)) {
      perf?.span("search_creators");
      const browseResponse = await searchCreators(
        supabase,
        "",
        pageSize,
        (page - 1) * pageSize
      );
      const browseHits = browseResponse.hits;
      const browseHasMore = creatorSearchHasMore(browseHits);
      const browseTotal = browseResponse.totalCount;
      if (browseHits.length === 0) {
        perf?.span("serialization");
        const result = {
          creators: [],
          total: browseTotal ?? 0,
          has_more: false,
          page,
          pageSize,
          internal_count: 0,
          discovery_count: 0,
        };
        perf?.end();
        return result;
      }

      const influencerIds = browseHits
        .filter((hit) => hit.source_type === "influencer")
        .map((hit) => hit.creator_id);
      const discoveredIds = browseHits
        .filter((hit) => hit.source_type === "discovered")
        .map((hit) => hit.creator_id);

      perf?.span("fetchInternalCreators");
      const internalPromise =
        influencerIds.length > 0
          ? fetchInternalCreators(
              supabase,
              {
                ...filters,
                search: undefined,
                influencerId: undefined,
                page: undefined,
                pageSize: undefined,
              },
              influencerIds,
              null,
              browseHydrationOptions
            )
          : Promise.resolve([]);
      perf?.span("fetchDiscoveryCreators");
      const discoveryPromise =
        discoveredIds.length > 0
          ? fetchDiscoveryCreators(
              supabase,
              {
                ...filters,
                search: undefined,
                discoveredProfileId: undefined,
                page: undefined,
                pageSize: undefined,
              },
              discoveredIds
            )
          : Promise.resolve([]);
      const [internal, discovery] = await Promise.all([internalPromise, discoveryPromise]);

      perf?.span("merge");
      let merged = mergeCreatorsInSearchOrder(browseHits, internal, discovery);
      merged = applyPostBrowseFilters(merged, filters);

      perf?.span("serialization");
      const result = {
        creators: stripRecentPublicationsForBrowse(merged),
        total:
          browseTotal ??
          (page - 1) * pageSize + merged.length + (browseHasMore ? 1 : 0),
        has_more: browseHasMore,
        page,
        pageSize,
        internal_count: internal.length,
        discovery_count: discovery.length,
      };
      perf?.end();
      return result;
    }

    perf?.span("fetchInternalCreators");
    const internalPromise = includeInternal
      ? fetchInternalCreatorsBrowsePage(supabase, filters, page, pageSize)
      : Promise.resolve([]);
    perf?.span("fetchDiscoveryCreators");
    const discoveryPromise = includeDiscovery
      ? fetchDiscoveryCreators(supabase, {
          ...filters,
          search: undefined,
          page,
          pageSize,
        })
      : Promise.resolve([]);
    const [internal, discovery] = await Promise.all([internalPromise, discoveryPromise]);

    perf?.span("merge");
    let merged = [...internal, ...discovery];
    merged.sort((a, b) => b.thinkway_score - a.thinkway_score);
    merged = applyPostBrowseFilters(merged, filters);

    perf?.span("serialization");
    const result = {
      creators: stripRecentPublicationsForBrowse(merged),
      total: merged.length,
      page,
      pageSize,
      internal_count: internal.length,
      discovery_count: discovery.length,
    };
    perf?.end();
    return result;
  }

  perf?.span("search_creators");
  const searchResponse = search
    ? await resolveCreatorSearchHits(supabase, search, pageSize, (page - 1) * pageSize)
    : { hits: [], totalCount: undefined };
  const searchHits = searchResponse.hits;
  const searchHasMore = creatorSearchHasMore(searchHits);
  const searchTotal = page === 1 ? searchResponse.totalCount : undefined;
  const influencerRankMap = influencerRankMapFromHits(searchHits);
  const influencerSearchIds = search
    ? searchHits
        .filter((hit) => hit.source_type === "influencer")
        .map((hit) => hit.creator_id)
    : null;
  const discoverySearchIds = search
    ? searchHits
        .filter((hit) => hit.source_type === "discovered")
        .map((hit) => hit.creator_id)
    : null;
  const scopedInfluencerIds =
    influencerSearchIds && influencerSearchIds.length > 0
      ? influencerSearchIds
      : search
        ? []
        : undefined;
  const scopedDiscoveryIds =
    discoverySearchIds && discoverySearchIds.length > 0 ? discoverySearchIds : undefined;

  if (
    search &&
    searchHits.length === 0
  ) {
    perf?.span("serialization");
    const result = {
      creators: [],
      total: 0,
      has_more: false,
      page,
      pageSize,
      internal_count: 0,
      discovery_count: 0,
    };
    perf?.end();
    return result;
  }

  perf?.span("fetchInternalCreators");
  const internalPromise = fetchInternalCreators(
    supabase,
    { ...filters, search: undefined },
    scopedInfluencerIds,
    influencerRankMap,
    browseHydrationOptions
  );
  perf?.span("fetchDiscoveryCreators");
  const discoveryPromise = fetchDiscoveryCreators(
    supabase,
    { ...filters, search: undefined },
    scopedDiscoveryIds
  );
  const [internal, discovery] = await Promise.all([internalPromise, discoveryPromise]);

  perf?.span("merge");
  let merged: UnifiedCreatorResult[];
  if (search && searchHits.length > 0) {
    merged = mergeCreatorsInSearchOrder(searchHits, internal, discovery);
  } else if (search) {
    merged = [...internal, ...discovery];
    merged.sort(
      (a, b) =>
        (b.search_rank ?? 0) - (a.search_rank ?? 0) ||
        b.thinkway_score - a.thinkway_score
    );
  } else {
    merged = [...internal, ...discovery];
    merged.sort((a, b) => b.thinkway_score - a.thinkway_score);
  }

  merged = applyPostBrowseFilters(merged, filters);
  if (search) {
    merged = dedupeSearchResultsByHandle(merged);
  }

  perf?.span("serialization");
  const result = {
    creators: stripRecentPublicationsForBrowse(merged),
    total:
      searchTotal ??
      (page - 1) * pageSize + merged.length + (searchHasMore ? 1 : 0),
    has_more: searchHasMore,
    page,
    pageSize,
    internal_count: internal.length,
    discovery_count: discovery.length,
  };
  perf?.end();
  return result;
}

export type UnifiedCreatorRefLookup = {
  byUnifiedId: Map<string, UnifiedCreatorResult>;
  byInfluencerId: Map<string, UnifiedCreatorResult>;
  byDiscoveryId: Map<string, UnifiedCreatorResult>;
};

function indexUnifiedCreator(
  creator: UnifiedCreatorResult,
  lookup: UnifiedCreatorRefLookup
): void {
  lookup.byUnifiedId.set(creator.unified_id, creator);
  if (creator.influencer_id) lookup.byInfluencerId.set(creator.influencer_id, creator);
  if (creator.discovered_profile_id) {
    lookup.byDiscoveryId.set(creator.discovered_profile_id, creator);
  }
}

function emptyUnifiedCreatorRefLookup(): UnifiedCreatorRefLookup {
  return {
    byUnifiedId: new Map(),
    byInfluencerId: new Map(),
    byDiscoveryId: new Map(),
  };
}

/** Resolve creators by explicit shortlist/item refs — not a global browse page. */
export async function resolveUnifiedCreatorsByRefs(
  supabase: SupabaseClient,
  refs: {
    unifiedIds?: Array<string | null | undefined>;
    influencerIds?: Array<string | null | undefined>;
    discoveredProfileIds?: Array<string | null | undefined>;
  }
): Promise<UnifiedCreatorRefLookup> {
  const lookup = emptyUnifiedCreatorRefLookup();

  const influencerIds = new Set<string>();
  const profileIds = new Set<string>();
  const unifiedIds = new Set<string>();

  for (const id of refs.unifiedIds ?? []) {
    if (!id) continue;
    unifiedIds.add(id);
    const [kind, rawId] = id.split(":");
    if (kind === "inf" && rawId) influencerIds.add(rawId);
    if (kind === "dis" && rawId) profileIds.add(rawId);
  }
  for (const id of refs.influencerIds ?? []) {
    if (id) influencerIds.add(id);
  }
  for (const id of refs.discoveredProfileIds ?? []) {
    if (id) profileIds.add(id);
  }

  const [internal, discovery] = await Promise.all([
    influencerIds.size > 0
      ? fetchInternalCreators(supabase, {}, [...influencerIds])
      : Promise.resolve([]),
    profileIds.size > 0
      ? fetchDiscoveryCreators(supabase, {}, [...profileIds])
      : Promise.resolve([]),
  ]);

  for (const creator of [...internal, ...discovery]) {
    indexUnifiedCreator(creator, lookup);
  }

  const missingUnified = [...unifiedIds].filter((id) => !lookup.byUnifiedId.has(id));
  const missingProfiles = [...profileIds].filter((id) => !lookup.byDiscoveryId.has(id));

  await Promise.all([
    ...missingUnified.map(async (unifiedId) => {
      const creator = await getUnifiedCreatorById(supabase, unifiedId);
      if (creator) indexUnifiedCreator(creator, lookup);
    }),
    ...missingProfiles
      .filter((profileId) => !lookup.byDiscoveryId.has(profileId))
      .map(async (profileId) => {
        const creator = await getUnifiedCreatorById(supabase, `dis:${profileId}`);
        if (creator) indexUnifiedCreator(creator, lookup);
      }),
  ]);

  return lookup;
}

export function resolveCreatorFromRefLookup(
  lookup: UnifiedCreatorRefLookup,
  item: {
    unified_id?: string | null;
    influencer_id?: string | null;
    profile_id?: string | null;
  }
): UnifiedCreatorResult | null {
  return (
    (item.unified_id ? lookup.byUnifiedId.get(item.unified_id) : null) ??
    (item.profile_id ? lookup.byDiscoveryId.get(item.profile_id) : null) ??
    (item.influencer_id ? lookup.byInfluencerId.get(item.influencer_id) : null) ??
    null
  );
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
