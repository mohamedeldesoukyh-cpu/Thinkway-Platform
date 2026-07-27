import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

import {
  applyCategoriesToArrayColumnQuery,
  creatorMatchesBrowseCategories,
  resolveBrowseCategories,
  shouldUseUnifiedBrowseIndexPath,
} from "@/lib/creators/category-filter";
import { unifiedToInfluencerSearch } from "@/lib/creators/adapters";
import { resolveCountryCode } from "@/lib/creators/country-code";
import {
  applyInfluencerCountryBrowseFilter,
  resolveCreatorCountryCodes,
} from "@/lib/creators/country-inference";
import {
  compareCategoryFiltering,
  creatorIntelligenceMatchesCategories,
  getCreatorIntelligenceMode,
} from "@/lib/creator-intelligence";
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
  type MetricsPlatformAccount,
} from "@/lib/creators/creator-centric";
import { mergeImportedStringArrays } from "@/lib/discovery-import/normalize";
import { normalizeCreatorRecentPublications } from "@/lib/creators/recent-publication-thumb";
import {
  normalizeContactLinks,
  pickCreatorContactFromPlatforms,
  resolveCreatorContactFields,
} from "@/lib/creators/contact-info";
import { createDiscoverySearchPerf } from "@/lib/creators/discovery-search-perf";
import {
  creatorSearchHasMore,
  searchCreators,
  searchInfluencerIdsByHandleFallback,
  type CreatorSearchHit,
} from "@/lib/creators/fts-search";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";
import { normalizeDiscoverySearchQuery } from "@/lib/discovery/creator-search-query";
import { formatCreatorBio, formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import {
  searchTrace,
  traceCountDrop,
  workflowTrace,
  type SearchTracePath,
} from "@/lib/creators/search-trace";
import { searchDiscoveredProfiles } from "@/lib/discovery/search";
import type { DiscoverySearchResult, ProfileAiScore, ProfileMetricsSnapshot } from "@/lib/discovery/types";
import { dedupeByCreatorId } from "@/lib/creators/dedupe-creators";
import {
  coverageIntentFromBrowseFilters,
  evaluateDiscoveryCoverage,
  getDiscoveryCoverageConfig,
  type DiscoveryCoverageIntent,
} from "@/lib/creators/discovery-coverage";
import { sortUnifiedCreatorsByDiscoveryRank } from "@/lib/creators/unified-ranking";
import { hydrateCreatorsWithDna, loadCanonicalDnaByInfluencerIds } from "@/lib/creators/dna-browse-hydration";
import { extractDnaAvatarUrl } from "@/lib/creators/dna-avatar";
import { compareBrowseRecencyDesc } from "@/lib/creators/last-enriched-sort";
import {
  BROWSE_PIN_PRIORITY_COUNTRY,
  BROWSE_PIN_PRIORITY_POOL_SIZE,
  browseSortedPoolHasMore,
  paginateBrowseCreators,
  resolveBrowseSortPoolSize,
  sortBrowseCreatorsInDefaultOrder,
} from "@/lib/creators/browse-pin-tier";
import {
  countBrowsableInfluencers,
  queryBrowsableInfluencerIdsByRecency,
} from "@/lib/creators/discovery-browse-pool";
import {
  applyDiscoveryBrowseFilters,
  hasDiscoveryAudienceBrowseFilters,
} from "@/lib/creators/discovery-browse-filters";
import { audienceDemographicsFromInfluencer } from "@/features/discovery/enrichment/adapters";
import {
  applyDataFreshnessFlags,
  applyPolicyToBrowse,
} from "@/lib/discovery/control-center/discovery-control-policy";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";

export {
  evaluateDiscoveryCoverage,
  coverageIntentFromBrowseFilters,
  getDiscoveryCoverageConfig,
  coverageMeetsThreshold,
  isDiscoveryCoverageApifyFallbackEnabled,
} from "@/lib/creators/discovery-coverage";
export type {
  DiscoveryCoverageEvaluation,
  DiscoveryCoverageIntent,
  DiscoveryCoverageLevel,
} from "@/lib/creators/discovery-coverage";

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
  const country = resolveCountryCode(filters.country) || null;
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
  pageSize: number,
  tracePath: SearchTracePath = "unknown"
): Promise<UnifiedCreatorResult[]> {
  const categories = resolveBrowseCategories(filters);
  let ids: string[] = [];

  if (categories.length > 0) {
    const browse = await queryInfluencerIdsForCategoryBrowse(supabase, filters, page, pageSize);
    ids = browse.ids;
  } else {
    const browse = await queryBrowsableInfluencerIdsByRecency(
      supabase,
      filters,
      page,
      pageSize
    );
    ids = browse.ids;
  }

  if (ids.length === 0) return [];

  const results = await fetchInternalCreators(
    supabase,
    { ...filters, search: undefined, page: undefined, pageSize: undefined },
    ids,
    null,
    { omitHeavyFields: true, tracePath }
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

  return countBrowsableInfluencers(supabase, filters);
}

function applyPostBrowseFilters(
  merged: UnifiedCreatorResult[],
  filters: UnifiedCreatorBrowseFilters,
  tracePath: SearchTracePath = "unknown"
): UnifiedCreatorResult[] {
  const pathOpt = { path: tracePath };
  let results = merged;
  const initialCount = results.length;

  if (filters.productionOnly !== false) {
    const next = results.filter(passesProductionCreatorGate);
    traceCountDrop("8_post_filter", "productionOnly", results.length, next.length, {
      productionOnly: filters.productionOnly,
    }, pathOpt);
    results = next;
  }

  const categories = resolveBrowseCategories(filters);
  if (categories.length > 0) {
    // Creator Intelligence rollout (see docs/CREATOR_INTELLIGENCE_ARCHITECTURE.md):
    //   off (default) — legacy stored-tag matching, unchanged behavior;
    //   shadow — legacy behavior + logged CI comparison (migration telemetry);
    //   on — resolved-intelligence matching drives the category decision, with
    //        legacy tags as a union fallback so sparse enrichment never shrinks
    //        results below today's behavior during rollout.
    const ciMode = getCreatorIntelligenceMode();
    let next: UnifiedCreatorResult[];
    if (ciMode === "on") {
      next = results.filter(
        (creator) =>
          creatorIntelligenceMatchesCategories(creator, categories) ||
          creatorMatchesBrowseCategories(creator, categories)
      );
    } else {
      next = results.filter((creator) => creatorMatchesBrowseCategories(creator, categories));
      if (ciMode === "shadow") {
        searchTrace(
          "8_post_filter_ci_shadow",
          { categories, ...compareCategoryFiltering(results, categories) },
          pathOpt
        );
      }
    }
    traceCountDrop("8_post_filter", "categories", results.length, next.length, {
      categories,
      ciMode,
    }, pathOpt);
    results = next;
  }

  const platformFilterValues = [
    ...(filters.platform?.trim() ? [filters.platform.trim()] : []),
    ...(filters.platforms ?? []),
  ];
  if (platformFilterValues.length > 0) {
    const set = new Set(platformFilterValues.map((p) => p.toLowerCase()));
    const next = results.filter((c) =>
      c.platforms.some((p) => set.has(p.platform.toLowerCase()))
    );
    traceCountDrop("8_post_filter", "platforms", results.length, next.length, {
      platform: filters.platform,
      platforms: filters.platforms,
    }, pathOpt);
    results = next;
  }

  if (hasDiscoveryAudienceBrowseFilters(filters)) {
    const next = applyDiscoveryBrowseFilters(results, filters);
    traceCountDrop("8_post_filter", "discovery_audience", results.length, next.length, {
      audienceCountries: filters.audienceCountries,
      audienceInterestTags: filters.audienceInterestTags,
      audienceGender: filters.audienceGender,
      audienceAgeMin: filters.audienceAgeMin,
      audienceAgeMax: filters.audienceAgeMax,
      creatorCountries: filters.creatorCountries,
    }, pathOpt);
    results = next;
  }

  traceCountDrop("8_post_filter_final", "all", initialCount, results.length, {
    country: filters.country,
    minFollowers: filters.minFollowers,
    maxFollowers: filters.maxFollowers,
    minEngagement: filters.minEngagement,
  }, pathOpt);

  return results;
}

const DISCOVERY_AUDIENCE_FILTER_BATCH = 100;

const INTERNAL_ID_QUERY_BATCH_SIZE = 80;

function chunkValues<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function estimateDiscoveryBrowseRawTotal(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  tracePath: SearchTracePath
): Promise<number> {
  const categories = resolveBrowseCategories(filters);
  if (categories.length > 0) {
    return countInternalCreatorsBrowse(supabase, filters);
  }
  if (shouldUseUnifiedBrowseIndexPath(filters)) {
    const response = await searchCreators(supabase, "", 1, 0, tracePath);
    return response.totalCount ?? 0;
  }
  return countInternalCreatorsBrowse(supabase, filters);
}

async function fetchDiscoveryBrowseBatch(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  batchPage: number,
  batchSize: number,
  tracePath: SearchTracePath
): Promise<UnifiedCreatorResult[]> {
  const sourceFilter = filters.source ?? "all";
  const includeInternal =
    sourceFilter === "all" ||
    sourceFilter === "internal" ||
    sourceFilter === "imported" ||
    sourceFilter === "oauth_verified";
  const includeDiscovery =
    sourceFilter === "all" ||
    sourceFilter === "public_discovery" ||
    sourceFilter === "imported";

  const [internal, discovery] = await Promise.all([
    includeInternal
      ? fetchInternalCreatorsBrowsePage(supabase, filters, batchPage, batchSize, tracePath)
      : Promise.resolve([]),
    includeDiscovery
      ? fetchDiscoveryCreators(
          supabase,
          { ...filters, search: undefined, page: batchPage, pageSize: batchSize },
          undefined,
          tracePath
        )
      : Promise.resolve([]),
  ]);

  return [...internal, ...discovery];
}

/**
 * Scan-hydrate-filter paginate when Discovery audience chips are active so
 * `total` matches displayed rows (avoids "5120 matched / 0 loaded").
 */
async function browseDiscoveryAudienceFilteredPage(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  page: number,
  pageSize: number,
  tracePath: SearchTracePath
): Promise<{ creators: UnifiedCreatorResult[]; total: number; has_more: boolean }> {
  const filtered: UnifiedCreatorResult[] = [];
  let batchPage = 1;
  let rawExhausted = false;
  const rawTotal = await estimateDiscoveryBrowseRawTotal(supabase, filters, tracePath);
  const maxBatchPages = Math.max(1, Math.ceil(rawTotal / DISCOVERY_AUDIENCE_FILTER_BATCH) + 2);
  const targetEnd = page * pageSize;

  // Scan only until the requested page is filled (or raw pool exhausted).
  // Do NOT continue scanning the full catalog just to compute an exact total —
  // that was O(catalog) hydration. See docs/DISCOVERY_BROWSE_PERFORMANCE.md.
  while (filtered.length < targetEnd && !rawExhausted && batchPage <= maxBatchPages) {
    const batch = await fetchDiscoveryBrowseBatch(
      supabase,
      filters,
      batchPage,
      DISCOVERY_AUDIENCE_FILTER_BATCH,
      tracePath
    );
    if (batch.length === 0) {
      rawExhausted = true;
      break;
    }
    filtered.push(...applyPostBrowseFilters(batch, filters, tracePath));
    if (batch.length < DISCOVERY_AUDIENCE_FILTER_BATCH) rawExhausted = true;
    batchPage += 1;
  }

  const uniqueFiltered = [...new Map(filtered.map((c) => [c.unified_id, c])).values()];
  uniqueFiltered.sort((a, b) => compareBrowseRecencyDesc(a, b));
  const offset = (page - 1) * pageSize;
  const pageCreators = uniqueFiltered.slice(offset, offset + pageSize);
  const hasMoreInWindow = offset + pageCreators.length < uniqueFiltered.length;
  const has_more = hasMoreInWindow || !rawExhausted;
  // Exact total only when the raw pool was exhausted during the page-fill scan;
  // otherwise expose a lower-bound total so the UI can keep "has more" truthful.
  const total = rawExhausted
    ? uniqueFiltered.length
    : Math.max(uniqueFiltered.length, offset + pageCreators.length + (has_more ? 1 : 0));

  return {
    creators: pageCreators,
    total,
    has_more,
  };
}

/** Prefer platform account photo; fall back through avatar_url chain when missing/broken. */
function resolveCreatorProfileImageUrl(
  platform: string | null | undefined,
  platformPictureUrl: string | null | undefined,
  platformAvatarUrl: string | null | undefined,
  discoveryProfileImageUrl: string | null | undefined,
  influencerAvatarUrl?: string | null | undefined
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

function normalizeEnrichmentStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
    follower_count?: number | null;
    engagement_rate?: number | null;
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
  options?: { omitHeavyFields?: boolean; skipDna?: boolean; tracePath?: SearchTracePath }
): Promise<UnifiedCreatorResult[]> {
  const tracePath = options?.tracePath ?? "unknown";
  const pathOpt = { path: tracePath };
  const search = filters.search?.trim() ?? "";
  const platform = filters.platform?.trim() ?? "";
  const country = resolveCountryCode(filters.country);
  const categories = resolveBrowseCategories(filters);
  const resolvedSearchRankById = searchRankById ?? null;
  const omitHeavyFields = options?.omitHeavyFields ?? false;
  const skipDna = options?.skipDna ?? false;
  // Browse/list: skip pre-map DNA fetch; apply once via hydrateCreatorsWithDna below.
  const skipPreMapDna = skipDna || omitHeavyFields;

  if (search && scopedInfluencerIds && scopedInfluencerIds.length === 0) {
    return [];
  }

  const candidateIds =
    scopedInfluencerIds ??
    (resolvedSearchRankById ? [...resolvedSearchRankById.keys()] : null);

  let influencerIds: string[] | null = candidateIds;

  const scopedFromSearch = Boolean(scopedInfluencerIds && scopedInfluencerIds.length > 0);

  if (
    !scopedFromSearch &&
    (platform ||
      filters.minFollowers != null ||
      filters.maxFollowers != null ||
      filters.minEngagement != null)
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

  if (scopedIds) {
    if (scopedIds.length === 0) {
      searchTrace("6_internal_hydration", {
        count: 0,
        reason: "empty_scoped_ids",
        country,
        categories,
        scopedIdCount: 0,
      }, pathOpt);
      return [];
    }
  } else if (!filters.influencerId) {
    return [];
  }

  type InfluencerHydrationRow = {
    id: string;
    document_number: string;
    display_name: string;
    status: string;
    country_code: string | null;
    /** Present only after migration `20260719100000_influencer_country_codes`. */
    country_codes?: string[] | null;
    categories: string[];
    notes: string | null;
    thinkway_score: number | null;
    source_confidence: number | null;
    enrichment_status?: string | null;
    last_enriched_at?: string | null;
    updated_at?: string | null;
    enrichment_source?: string | null;
    profile_id?: string | null;
    metadata?: Record<string, unknown> | null;
    primary_avatar_url?: string | null;
    primary_avatar_source?: string | null;
    default_metrics_platform_account_id?: string | null;
    audience_age_13_17?: number | null;
    audience_age_18_24?: number | null;
    audience_age_25_34?: number | null;
    audience_age_35_44?: number | null;
    audience_age_45_54?: number | null;
    audience_age_55_plus?: number | null;
    audience_gender_male?: number | null;
    audience_gender_female?: number | null;
    audience_gender_unknown?: number | null;
    audience_top_countries?: Array<{ code?: string; name?: string; percent?: number }> | null;
    demographic_source?: string | null;
    rate_card?: unknown;
    payment_details?: unknown;
    email?: string | null;
    phone?: string | null;
  };

  async function queryInfluencerRows(ids: string[]): Promise<InfluencerHydrationRow[]> {
    const influencerSelect = omitHeavyFields
      ? "id, document_number, display_name, status, country_code, country_codes, categories, notes, thinkway_score, source_confidence, profile_id, metadata, enrichment_status, last_enriched_at, updated_at, enrichment_source, primary_avatar_url, primary_avatar_source, default_metrics_platform_account_id"
      : "id, document_number, display_name, status, country_code, country_codes, categories, notes, email, phone, rate_card, payment_details, thinkway_score, source_confidence, profile_id, metadata, enrichment_status, last_enriched_at, updated_at, enrichment_source, primary_avatar_url, primary_avatar_source, default_metrics_platform_account_id, audience_age_13_17, audience_age_18_24, audience_age_25_34, audience_age_35_44, audience_age_45_54, audience_age_55_plus, audience_gender_male, audience_gender_female, audience_gender_unknown, audience_top_countries, demographic_source";

    // Dynamic select strings explode the typed client's union; keep the builder untyped.
    let rowQuery = (supabase as any).from("influencers").select(influencerSelect);

    rowQuery = explicitLookup
      ? rowQuery.in("status", [...RESOLVABLE_INFLUENCER_STATUSES])
      : rowQuery.in("status", [...BROWSE_INFLUENCER_STATUSES]);

    if (filters.influencerId) {
      rowQuery = rowQuery.eq("id", filters.influencerId);
    }

    if (country) rowQuery = applyInfluencerCountryBrowseFilter(rowQuery, country);
    if (categories.length > 0 && !scopedIds) {
      rowQuery = applyCategoriesToArrayColumnQuery(rowQuery, "categories", categories);
    }
    if (filters.language) rowQuery = rowQuery.contains("languages", [filters.language]);

    rowQuery = rowQuery.in("id", ids);
    const { data: rows, error } = await rowQuery;
    if (error) throw new Error(error.message);
    return (rows ?? []) as InfluencerHydrationRow[];
  }

  let influencerRows: InfluencerHydrationRow[] = [];
  if (scopedIds) {
    for (const chunk of chunkValues(scopedIds, INTERNAL_ID_QUERY_BATCH_SIZE)) {
      influencerRows.push(...(await queryInfluencerRows(chunk)));
    }
  } else if (filters.influencerId) {
    influencerRows = await queryInfluencerRows([filters.influencerId]);
  } else {
    return [];
  }

  const data = influencerRows;

  const ids = (data ?? []).map((r) => r.id);
  searchTrace("6_internal_hydration_query", {
    hydratedIdCount: ids.length,
    scopedIdCount: scopedIds?.length ?? null,
    country,
    categories,
    platform,
    minFollowers: filters.minFollowers,
    maxFollowers: filters.maxFollowers,
    minEngagement: filters.minEngagement,
  }, pathOpt);
  if (ids.length === 0) return [];

  const { data: linkedDiscovery } =
    ids.length > INTERNAL_ID_QUERY_BATCH_SIZE
      ? {
          data: (
            await Promise.all(
              chunkValues(ids, INTERNAL_ID_QUERY_BATCH_SIZE).map((chunk) =>
                supabase
                  .from("discovered_profiles")
                  .select("id, influencer_id, profile_image_url")
                  .in("influencer_id", chunk)
              )
            )
          ).flatMap((result) => {
            if (result.error) throw new Error(result.error.message);
            return result.data ?? [];
          }),
        }
      : await supabase
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

  const importSourceRows =
    ids.length > INTERNAL_ID_QUERY_BATCH_SIZE
      ? (
          await Promise.all(
            chunkValues(ids, INTERNAL_ID_QUERY_BATCH_SIZE).map((chunk) =>
              supabase.from("creator_sources").select("influencer_id").in("influencer_id", chunk)
            )
          )
        ).flatMap((result) => {
          if (result.error) throw new Error(result.error.message);
          return result.data ?? [];
        })
      : (
          await supabase.from("creator_sources").select("influencer_id").in("influencer_id", ids)
        ).data;

  const importedByInfluencerId = new Set(
    (importSourceRows ?? []).map((row) => row.influencer_id as string)
  );

  // Browse (omitHeavyFields): include recent_publications for Search feed thumbs, then
  // slimRecentPublicationsForBrowse keeps ≤3 creator-level display rows and strips
  // platform JSONB. Do not pull bio/contacts/hashtags on the list path.
  const accountSelect = omitHeavyFields
    ? "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, audience_country, is_verified, is_primary, profile_picture_url, recent_publications, metrics_source, sync_status, sync_source, sync_error, metrics_is_manual_override, metadata, avatar_source, interest_categories, enrichment_status"
    : "id, influencer_id, platform, handle, profile_url, follower_count, engagement_rate, avg_likes, avg_comments, avg_views, audience_country, is_verified, is_primary, profile_picture_url, profile_bio, hashtags, mentions, recent_publications, contact_email, contact_phone, contact_links, metrics_source, sync_status, sync_source, sync_error, metrics_is_manual_override, metadata, avatar_source, interest_categories, enrichment_status";

  type PlatformAccountHydrationRow = MetricsPlatformAccount & {
    influencer_id: string;
    handle?: string | null;
    profile_url?: string | null;
    is_verified?: boolean | null;
    is_primary?: boolean | null;
    profile_picture_url?: string | null;
    sync_source?: string | null;
    sync_error?: string | null;
    avatar_source?: string | null;
    enrichment_status?: CreatorEnrichmentStatus | null;
  };

  const accounts: PlatformAccountHydrationRow[] =
    ids.length > INTERNAL_ID_QUERY_BATCH_SIZE
      ? (
          await Promise.all(
            chunkValues(ids, INTERNAL_ID_QUERY_BATCH_SIZE).map((chunk) =>
              (supabase as any)
                .from("influencer_platform_accounts")
                .select(accountSelect)
                .in("influencer_id", chunk)
            )
          )
        ).flatMap((result: { data: PlatformAccountHydrationRow[] | null; error: { message: string } | null }) => {
          if (result.error) throw new Error(result.error.message);
          return result.data ?? [];
        })
      : ((
          await (supabase as any)
            .from("influencer_platform_accounts")
            .select(accountSelect)
            .in("influencer_id", ids)
        ).data ?? []) as PlatformAccountHydrationRow[];

  const accountsByInfluencer = new Map<string, PlatformAccountHydrationRow[]>();
  for (const account of accounts) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push(account);
    accountsByInfluencer.set(account.influencer_id, list);
  }

  const dnaByInfluencer = skipPreMapDna
    ? new Map()
    : await loadCanonicalDnaByInfluencerIds(supabase, ids);

  const results: UnifiedCreatorResult[] = [];

  for (const row of data ?? []) {
    const r = row as InfluencerHydrationRow;
    const platformRows = sortPlatformsStable(accountsByInfluencer.get(r.id) ?? []);
    const defaultMetricsAccountId = resolveDefaultMetricsPlatformAccountId(
      platformRows,
      r.default_metrics_platform_account_id
    );
    const metricsAccount =
      findPlatformAccountById(platformRows, defaultMetricsAccountId) ?? platformRows[0];
    const profileBio = formatCreatorBio(
      (metricsAccount as { profile_bio?: string | null } | undefined)?.profile_bio ?? null
    );
    const profileHashtags = normalizeEnrichmentStringArray(
      (metricsAccount as { hashtags?: string[] | null } | undefined)?.hashtags
    );
    const profileMentions = normalizeEnrichmentStringArray(
      (metricsAccount as { mentions?: string[] | null } | undefined)?.mentions
    );
    const platformContact = pickCreatorContactFromPlatforms(
      platformRows,
      defaultMetricsAccountId
    );
    // Prefer platform contact; fall back to vendor master email/phone so overview + sheet stay aligned.
    const creatorContact = resolveCreatorContactFields({
      contact_email: platformContact.contact_email ?? r.email,
      contact_phone: platformContact.contact_phone ?? r.phone,
      contact_links: platformContact.contact_links,
    });
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
      dnaAvatarUrl: extractDnaAvatarUrl(dnaByInfluencer.get(r.id) ?? null),
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
      display_name:
        formatCreatorDisplayName(r.display_name) ||
        formatCreatorDisplayName(
          (metricsAccount as { profile_display_name?: string | null } | undefined)
            ?.profile_display_name
        ) ||
        metricsAccount?.handle?.replace(/^@+/, "").trim() ||
        (metricsAccount as { username?: string | null } | undefined)?.username?.trim() ||
        r.document_number ||
        "Creator",
      status: r.status,
      country_code: r.country_code,
      country_codes: resolveCreatorCountryCodes({
        country_codes: r.country_codes,
        country_code: r.country_code,
        estimated_country: metricsAccount?.audience_country ?? r.country_code,
        platformAudienceCountries: platformRows.map((p) => p.audience_country),
      }),
      estimated_country: metricsAccount?.audience_country ?? r.country_code,
      city: null,
      categories,
      browse_category_tags: storedCategoryTags,
      audience_interests: audienceInterests,
      audience_demographics: audienceDemographicsFromInfluencer({
        audience_age_13_17: r.audience_age_13_17,
        audience_age_18_24: r.audience_age_18_24,
        audience_age_25_34: r.audience_age_25_34,
        audience_age_35_44: r.audience_age_35_44,
        audience_age_45_54: r.audience_age_45_54,
        audience_age_55_plus: r.audience_age_55_plus,
        audience_gender_male: r.audience_gender_male,
        audience_gender_female: r.audience_gender_female,
        audience_gender_unknown: r.audience_gender_unknown,
        audience_top_countries: r.audience_top_countries,
        demographic_source: r.demographic_source as
          | import("@/features/discovery/enrichment/status").DemographicSource
          | null
          | undefined,
      }),
      language_codes: [],
      profile_image_url: profileImageUrl,
      primaryAvatarUrl: profileImageUrl,
      primaryAvatarSource: avatarResolved.source,
      default_metrics_platform_account_id: defaultMetricsAccountId,
      bio: profileBio,
      hashtags: profileHashtags,
      mentions: profileMentions,
      contact_email: creatorContact.contact_email,
      contact_phone: creatorContact.contact_phone,
      contact_links: creatorContact.contact_links,
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
        handle: p.handle ?? "",
        profile_url: p.profile_url ?? null,
        follower_count: p.follower_count ?? null,
        engagement_rate: p.engagement_rate ?? null,
        avg_likes: p.avg_likes,
        avg_comments: p.avg_comments,
        avg_views: p.avg_views,
        audience_country: p.audience_country ?? null,
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
        profile_bio: formatCreatorBio(
          (p as { profile_bio?: string | null }).profile_bio ?? null
        ),
        hashtags: normalizeEnrichmentStringArray((p as { hashtags?: string[] | null }).hashtags),
        mentions: normalizeEnrichmentStringArray((p as { mentions?: string[] | null }).mentions),
        ...resolveCreatorContactFields({
          contact_email: (p as { contact_email?: string | null }).contact_email,
          contact_phone: (p as { contact_phone?: string | null }).contact_phone,
          contact_links: normalizeContactLinks(
            (p as { contact_links?: string[] | null }).contact_links
          ),
        }),
        recent_publications: normalizeCreatorRecentPublications(
          (p as { recent_publications?: unknown }).recent_publications
        ),
        sync_source: (p as { sync_source?: string | null }).sync_source ?? null,
        sync_status: (p as { sync_status?: string | null }).sync_status ?? null,
        sync_error: (p as { sync_error?: string | null }).sync_error ?? null,
        enrichment_status:
          (p as { enrichment_status?: UnifiedCreatorResult["enrichment_status"] }).enrichment_status ??
          null,
      })),
      notes: r.notes,
      suggested_currency: DEFAULT_PLATFORM_CURRENCY,
      rate_card:
        r.rate_card && typeof r.rate_card === "object"
          ? (r.rate_card as Record<string, unknown>)
          : null,
      enrichment_status: resolveAggregatedCreatorEnrichmentStatus({
        creatorId: r.id,
        storedStatus: (r.enrichment_status as CreatorEnrichmentStatus | null) ?? "never",
        platformStatuses: platformRows.map(
          (p) => (p as { enrichment_status?: CreatorEnrichmentStatus | null }).enrichment_status
        ),
        hasInflightJob: false,
      }),
      last_enriched_at: r.last_enriched_at ?? null,
      updated_at: r.updated_at ?? null,
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
    const beforeCategory = results.length;
    const filtered = results.filter((creator) => creatorMatchesBrowseCategories(creator, categories));
    traceCountDrop("6_internal_hydration", "categories", beforeCategory, filtered.length, {
      categories,
    }, pathOpt);
    if (skipDna) return filtered;
    return hydrateCreatorsWithDna(supabase, filtered);
  }

  searchTrace("6_internal_hydration", { count: results.length }, pathOpt);
  if (skipDna) return results;
  return hydrateCreatorsWithDna(supabase, results);
}

type CreatorSearchHitsResult = {
  hits: CreatorSearchHit[];
  totalCount?: number;
};

async function resolveCreatorSearchHits(
  supabase: SupabaseClient,
  search: string,
  pageSize: number,
  offset: number,
  tracePath: SearchTracePath = "unknown"
): Promise<CreatorSearchHitsResult> {
  let response = await searchCreators(supabase, search, pageSize, offset, tracePath);
  if (response.hits.length > 0 || !search) return response;

  const normalizedQuery = normalizeDiscoverySearchQuery(search);
  if (normalizedQuery && normalizedQuery !== search.trim()) {
    response = await searchCreators(supabase, normalizedQuery, pageSize, offset, tracePath);
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

const BROWSE_FEED_THUMB_LIMIT = 3;

/** Display-only feed thumb row — no caption/metrics payload on browse. */
function toBrowseFeedPublication(
  pub: NonNullable<UnifiedCreatorResult["recent_publications"]>[number]
): NonNullable<UnifiedCreatorResult["recent_publications"]>[number] {
  return {
    url: pub.url ?? null,
    thumbnail: pub.thumbnail ?? null,
    likes: null,
    comments: null,
    views: null,
    posted_at: null,
    caption: null,
    isVideo: pub.isVideo,
  };
}

/** Keep slim creator-level feed thumbs for Search browse; strip heavy platform JSONB. */
export function slimRecentPublicationsForBrowse(
  creators: UnifiedCreatorResult[]
): UnifiedCreatorResult[] {
  return creators.map(({ recent_publications, platforms, ...creator }) => {
    const creatorPubs = recent_publications ?? [];
    const mergedPubs =
      creatorPubs.length > 0
        ? creatorPubs
        : platforms.flatMap((platform) => platform.recent_publications ?? []);
    return {
      ...creator,
      recent_publications: mergedPubs
        .filter((pub) => Boolean(pub.thumbnail?.trim() || pub.url?.trim()))
        .slice(0, BROWSE_FEED_THUMB_LIMIT)
        .map(toBrowseFeedPublication),
      platforms: platforms.map(({ recent_publications: _pubs, ...platform }) => platform),
    };
  });
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
      bio: formatCreatorBio(profile.bio),
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
        bio: formatCreatorBio(profile.bio),
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
      display_name:
        formatCreatorDisplayName(profile.display_name) ||
        formatCreatorDisplayName(profile.username) ||
        profile.username?.trim() ||
        "Creator",
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
      bio: formatCreatorBio(profile.bio),
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
      last_enriched_at: profile.last_enriched_at ?? null,
      updated_at: profile.updated_at ?? null,
    });
  }

  return results;
}

async function fetchDiscoveryCreators(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  scopedDiscoveredProfileIds?: string[],
  tracePath: SearchTracePath = "unknown",
  options?: { skipDna?: boolean }
): Promise<UnifiedCreatorResult[]> {
  const pathOpt = { path: tracePath };
  const skipDna = options?.skipDna ?? false;
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

    return skipDna
      ? mapDiscoveryProfileToUnifiedResults([profile], filters)
      : hydrateCreatorsWithDna(
          supabase,
          mapDiscoveryProfileToUnifiedResults([profile], filters)
        );
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

  const results = mapDiscoveryProfileToUnifiedResults(discovery.profiles, filters);
  searchTrace("7_discovery_hydration", {
    count: results.length,
    rawProfileCount: discovery.profiles.length,
    scopedProfileIdCount: scopedDiscoveredProfileIds?.length ?? null,
    country: filters.country,
    categories: resolveBrowseCategories(filters),
    search: filters.search,
  }, pathOpt);
  return skipDna ? results : hydrateCreatorsWithDna(supabase, results);
}

function dedupeUnifiedCreatorsById(
  creators: UnifiedCreatorResult[],
  tracePath: SearchTracePath = "unknown"
): UnifiedCreatorResult[] {
  const pathOpt = { path: tracePath };
  const before = creators.length;
  const { items } = dedupeByCreatorId(creators, (c) => c.unified_id);
  if (before !== items.length) {
    traceCountDrop("8_dedupe_by_id", "unified_id", before, items.length, undefined, pathOpt);
  }
  return items;
}

function traceBrowseUnifiedResult(
  result: UnifiedCreatorBrowseResult,
  tracePath: SearchTracePath,
  filters?: UnifiedCreatorBrowseFilters,
  settings?: import("@/lib/discovery/control-center/discovery-control-types").DiscoveryControlSettings
): UnifiedCreatorBrowseResult {
  const pathOpt = { path: tracePath };
  let creators = dedupeUnifiedCreatorsById(result.creators, tracePath);

  if (settings) {
    creators = applyDataFreshnessFlags(creators, settings);
  }

  if (tracePath === "ai" || tracePath === "discovery") {
    const coverageIntent: DiscoveryCoverageIntent = {
      ...coverageIntentFromBrowseFilters(filters ?? {}),
      ...(filters?.coverageIntent ?? {}),
    };
    creators = sortUnifiedCreatorsByDiscoveryRank(creators, coverageIntent);
  }

  const normalized: UnifiedCreatorBrowseResult = {
    ...result,
    creators,
  };

  if (tracePath === "ai" || tracePath === "discovery") {
    const coverageIntent: DiscoveryCoverageIntent = {
      ...coverageIntentFromBrowseFilters(filters ?? {}),
      ...(filters?.coverageIntent ?? {}),
    };
    normalized.coverage = evaluateDiscoveryCoverage(
      normalized,
      coverageIntent,
      settings ? getDiscoveryCoverageConfig(settings) : undefined
    );
    searchTrace("coverage_evaluation", {
      score: normalized.coverage.coverageScore,
      level: normalized.coverage.coverageLevel,
      missingReasons: normalized.coverage.missingReasons,
      count: normalized.coverage.breakdown.count,
    }, pathOpt);
  }

  workflowTrace("1_browseUnifiedCreators", normalized, "browseUnifiedCreators", {
    path: tracePath,
    internal_count: normalized.internal_count ?? null,
    discovery_count: normalized.discovery_count ?? null,
    coverage_score: normalized.coverage?.coverageScore ?? null,
    coverage_level: normalized.coverage?.coverageLevel ?? null,
  });
  return normalized;
}

export async function browseUnifiedCreators(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  tracePath: SearchTracePath = "unknown"
): Promise<UnifiedCreatorBrowseResult> {
  const settings = await getDiscoveryControlSettings(supabase);
  filters = applyPolicyToBrowse(filters, settings);
  const perf = createDiscoverySearchPerf("browseUnifiedCreators");
  const pathOpt = { path: tracePath };

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? 20));
  const search = filters.search?.trim() ?? "";
  const sourceFilter = filters.source ?? "all";
  const browseHydrationOptions = { omitHeavyFields: true, tracePath };
  const categories = resolveBrowseCategories(filters);

  searchTrace("4_browse_entry", {
    search,
    country: filters.country,
    categories,
    platform: filters.platform,
    platforms: filters.platforms,
    productionOnly: filters.productionOnly,
    page,
    pageSize,
    branch:
      filters.influencerIds?.length
        ? "influencer_id_batch"
        : filters.influencerId || filters.discoveredProfileId
        ? "explicit_id"
        : !search
          ? categories.length > 0
            ? "category_browse"
            : "unfiltered_browse"
          : "fts_search",
  }, pathOpt);

  if (filters.influencerIds?.length) {
    perf?.span("fetchInternalCreators");
    const internal = await fetchInternalCreators(
      supabase,
      { ...filters, search: undefined, page: undefined, pageSize: undefined },
      filters.influencerIds,
      null,
      browseHydrationOptions
    );
    perf?.span("merge");
    let merged = applyPostBrowseFilters(internal, filters, tracePath);
    const byInfluencerId = new Map(
      merged
        .filter((creator) => creator.influencer_id)
        .map((creator) => [creator.influencer_id as string, creator])
    );
    const ordered = filters.influencerIds
      .map((id) => byInfluencerId.get(id))
      .filter((creator): creator is UnifiedCreatorResult => creator != null);
    if (ordered.length > 0) {
      merged = ordered;
    }
    perf?.span("serialization");
    const result = {
      creators: slimRecentPublicationsForBrowse(merged),
      total: merged.length,
      has_more: false,
      page: 1,
      pageSize: merged.length,
      internal_count: merged.length,
      discovery_count: 0,
    };
    perf?.end();
    return traceBrowseUnifiedResult(result, tracePath, filters, settings);
  }

  if (filters.influencerId || filters.discoveredProfileId) {
    perf?.span("fetchInternalCreators");
    const internalPromise = fetchInternalCreators(supabase, filters, undefined, null, {
      tracePath,
    });
    perf?.span("fetchDiscoveryCreators");
    const discoveryPromise = fetchDiscoveryCreators(supabase, filters, undefined, tracePath);
    const [internal, discovery] = await Promise.all([internalPromise, discoveryPromise]);
    perf?.span("merge");
    let merged = [...internal, ...discovery];
    if (filters.productionOnly !== false) {
      merged = merged.filter(passesProductionCreatorGate);
    }
    perf?.span("serialization");
    const result = {
      creators: slimRecentPublicationsForBrowse(merged),
      total: merged.length,
      page: 1,
      pageSize: merged.length,
      internal_count: internal.length,
      discovery_count: discovery.length,
    };
    perf?.end();
    return traceBrowseUnifiedResult(result, tracePath, filters, settings);
  }

  if (!search) {
    const includeInternal = sourceFilter === "all" || sourceFilter === "internal" || sourceFilter === "imported" || sourceFilter === "oauth_verified";
    const includeDiscovery = sourceFilter === "all" || sourceFilter === "public_discovery" || sourceFilter === "imported";
    const categoryFilterActive = resolveBrowseCategories(filters).length > 0;

    if (hasDiscoveryAudienceBrowseFilters(filters)) {
      perf?.span("discovery_audience_filter_scan");
      const filteredPage = await browseDiscoveryAudienceFilteredPage(
        supabase,
        filters,
        page,
        pageSize,
        tracePath
      );
      perf?.span("serialization");
      const result = {
        creators: slimRecentPublicationsForBrowse(filteredPage.creators),
        total: filteredPage.total,
        has_more: filteredPage.has_more,
        page,
        pageSize,
        internal_count: filteredPage.creators.filter((c) => c.influencer_id).length,
        discovery_count: filteredPage.creators.filter((c) => !c.influencer_id).length,
      };
      perf?.end();
      return traceBrowseUnifiedResult(result, tracePath, filters, settings);
    }

    if (categoryFilterActive && includeInternal) {
      perf?.span("fetchInternalCreators");
      const internalPromise = fetchInternalCreatorsBrowsePage(supabase, filters, page, pageSize, tracePath);
      perf?.span("fetchDiscoveryCreators");
      const discoveryPromise = includeDiscovery
        ? fetchDiscoveryCreators(
            supabase,
            {
              ...filters,
              search: undefined,
              page,
              pageSize,
            },
            undefined,
            tracePath
          )
        : Promise.resolve([]);
      perf?.span("search_creators_count");
      const totalPromise = countInternalCreatorsBrowse(supabase, filters);
      const [internal, discovery, totalMatches] = await Promise.all([
        internalPromise,
        discoveryPromise,
        totalPromise,
      ]);

      perf?.span("merge");
      const merged = applyPostBrowseFilters([...internal, ...discovery], filters, tracePath);
      const sortedMerged = sortBrowseCreatorsInDefaultOrder(merged);
      const offset = (page - 1) * pageSize;

      perf?.span("serialization");
      const result = {
        creators: slimRecentPublicationsForBrowse(sortedMerged),
        total: Math.max(totalMatches, sortedMerged.length),
        has_more: offset + sortedMerged.length < Math.max(totalMatches, sortedMerged.length),
        page,
        pageSize,
        internal_count: internal.length,
        discovery_count: discovery.length,
      };
      perf?.end();
      return traceBrowseUnifiedResult(result, tracePath, filters, settings);
    }

    if (includeInternal || includeDiscovery) {
      perf?.span("pin_sorted_browse_pool");
      const poolSize = resolveBrowseSortPoolSize(page, pageSize);
      const pinEgyptPool =
        page === 1 && !resolveCountryCode(filters.country ?? undefined);

      perf?.span("fetchInternalCreators");
      let priorityInternal: UnifiedCreatorResult[] = [];
      let priorityDiscovery: UnifiedCreatorResult[] = [];
      if (pinEgyptPool) {
        if (includeInternal) {
          priorityInternal = await fetchInternalCreatorsBrowsePage(
            supabase,
            { ...filters, country: BROWSE_PIN_PRIORITY_COUNTRY },
            1,
            BROWSE_PIN_PRIORITY_POOL_SIZE,
            tracePath
          );
        }
        if (includeDiscovery) {
          priorityDiscovery = await fetchDiscoveryCreators(
            supabase,
            {
              ...filters,
              search: undefined,
              country: BROWSE_PIN_PRIORITY_COUNTRY,
              page: 1,
              pageSize: BROWSE_PIN_PRIORITY_POOL_SIZE,
            },
            undefined,
            tracePath
          );
        }
      }

      const internalMainPromise = includeInternal
        ? fetchInternalCreatorsBrowsePage(supabase, filters, 1, poolSize, tracePath)
        : Promise.resolve<UnifiedCreatorResult[]>([]);
      const discoveryMainPromise = includeDiscovery
        ? fetchDiscoveryCreators(
            supabase,
            { ...filters, search: undefined, page: 1, pageSize: poolSize },
            undefined,
            tracePath
          )
        : Promise.resolve<UnifiedCreatorResult[]>([]);

      perf?.span("search_creators_count");
      const [internalMain, discoveryMain, internalTotal, discoveryTotal] = await Promise.all([
        internalMainPromise,
        discoveryMainPromise,
        includeInternal ? countInternalCreatorsBrowse(supabase, filters) : Promise.resolve(0),
        includeDiscovery
          ? searchDiscoveredProfiles(supabase, {
              page: 1,
              pageSize: 1,
            }).then((result) => result.total)
          : Promise.resolve(0),
      ]);

      perf?.span("merge");
      let merged = dedupeUnifiedCreatorsById(
        [...priorityInternal, ...priorityDiscovery, ...internalMain, ...discoveryMain],
        tracePath
      );
      merged = applyPostBrowseFilters(merged, filters, tracePath);
      merged = sortBrowseCreatorsInDefaultOrder(merged);
      const catalogTotal = internalTotal + discoveryTotal;
      const offset = (page - 1) * pageSize;
      const pageCreators = paginateBrowseCreators(merged, page, pageSize);

      perf?.span("serialization");
      const result = {
        creators: slimRecentPublicationsForBrowse(pageCreators),
        // Authoritative catalog size for the header badge; pagination stops at the
        // sorted pool (capped), not when catalogTotal is exhausted.
        total: Math.max(catalogTotal, offset + pageCreators.length),
        has_more: browseSortedPoolHasMore(offset, pageCreators.length, merged.length),
        page,
        pageSize,
        internal_count: pageCreators.filter((creator) => creator.influencer_id).length,
        discovery_count: pageCreators.filter((creator) => !creator.influencer_id).length,
      };
      perf?.end();
      return traceBrowseUnifiedResult(result, tracePath, filters, settings);
    }
  }

  perf?.span("search_creators");
  const searchResponse = search
    ? await resolveCreatorSearchHits(supabase, search, pageSize, (page - 1) * pageSize, tracePath)
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

  searchTrace("5_search_hits_resolved", {
    search,
    hitCount: searchHits.length,
    searchTotal: searchTotal ?? null,
    influencerHitCount: influencerSearchIds?.length ?? 0,
    discoveredHitCount: discoverySearchIds?.length ?? 0,
    scopedInfluencerIdCount: scopedInfluencerIds?.length ?? null,
    scopedDiscoveryIdCount: scopedDiscoveryIds?.length ?? null,
    country: filters.country,
    categories,
  }, pathOpt);

  if (
    search &&
    searchHits.length === 0 &&
    !filters.country &&
    categories.length === 0 &&
    !filters.platform &&
    !filters.platforms?.length
  ) {
    traceCountDrop("5_search_hits_resolved", "fts_zero_hits", 1, 0, {
      search,
      country: filters.country,
      categories,
    }, pathOpt);
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
    return traceBrowseUnifiedResult(result, tracePath, filters, settings);
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
    scopedDiscoveryIds,
    tracePath
  );
  const [internal, discovery] = await Promise.all([internalPromise, discoveryPromise]);

  searchTrace("6_7_hydration_complete", {
    internalCount: internal.length,
    discoveryCount: discovery.length,
    preMergeTotal: internal.length + discovery.length,
    country: filters.country,
    categories,
  }, pathOpt);

  perf?.span("merge");
  let merged: UnifiedCreatorResult[];
  const preMergeCount = internal.length + discovery.length;
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
    merged = sortBrowseCreatorsInDefaultOrder([...internal, ...discovery]);
  }

  merged = applyPostBrowseFilters(merged, filters, tracePath);
  if (search) {
    const beforeDedupe = merged.length;
    merged = dedupeSearchResultsByHandle(merged);
    traceCountDrop("8_dedupe_by_handle", "handle_dedupe", beforeDedupe, merged.length, undefined, pathOpt);
  }

  traceCountDrop("9_final", "pipeline", preMergeCount, merged.length, {
    searchTotal: searchTotal ?? null,
    country: filters.country,
    categories,
  }, pathOpt);

  perf?.span("serialization");
  const result = {
    creators: slimRecentPublicationsForBrowse(merged),
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
  return traceBrowseUnifiedResult(result, tracePath, filters, settings);
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

  const refLookupOptions = {
    omitHeavyFields: true,
    skipDna: true,
    tracePath: "unknown" as const,
  };

  const [internal, discovery] = await Promise.all([
    influencerIds.size > 0
      ? fetchInternalCreators(supabase, {}, [...influencerIds], null, refLookupOptions)
      : Promise.resolve([]),
    profileIds.size > 0
      ? fetchDiscoveryCreators(supabase, {}, [...profileIds], "unknown", { skipDna: true })
      : Promise.resolve([]),
  ]);

  for (const creator of [...internal, ...discovery]) {
    indexUnifiedCreator(creator, lookup);
  }

  const missingUnified = [...unifiedIds].filter((id) => !lookup.byUnifiedId.has(id));
  const missingProfiles = [...profileIds].filter((id) => !lookup.byDiscoveryId.has(id));

  await Promise.all([
    ...missingUnified.map(async (unifiedId) => {
      const creator = await getUnifiedCreatorById(supabase, unifiedId, { skipDna: true });
      if (creator) indexUnifiedCreator(creator, lookup);
    }),
    ...missingProfiles
      .filter((profileId) => !lookup.byDiscoveryId.has(profileId))
      .map(async (profileId) => {
        const creator = await getUnifiedCreatorById(supabase, `dis:${profileId}`, {
          skipDna: true,
        });
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
  unifiedId: string,
  options?: { skipDna?: boolean }
): Promise<UnifiedCreatorResult | null> {
  const skipDna = options?.skipDna ?? false;
  const [kind, id] = unifiedId.split(":");
  if (!id) return null;

  if (kind === "inf") {
    const internal = await fetchInternalCreators(
      supabase,
      { influencerId: id },
      undefined,
      null,
      { skipDna, omitHeavyFields: skipDna, tracePath: "unknown" }
    );
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
      const internal = await fetchInternalCreators(
        supabase,
        { influencerId: profileLink.influencer_id },
        undefined,
        null,
        { skipDna, omitHeavyFields: skipDna, tracePath: "unknown" }
      );
      return internal[0] ?? null;
    }

    const discovery = await fetchDiscoveryCreators(
      supabase,
      { discoveredProfileId: id },
      undefined,
      "unknown",
      { skipDna }
    );
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
