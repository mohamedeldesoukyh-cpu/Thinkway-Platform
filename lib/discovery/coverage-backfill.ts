import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignSearchIntent } from "@/features/ai/tools/campaign-search-intent";
import {
  type DiscoveryCoverageEvaluation,
  getDiscoveryCoverageConfig,
} from "@/lib/creators/discovery-coverage";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";
import {
  gateApifyBackfill,
  isApifyLiveOnly,
} from "@/lib/discovery/control-center/discovery-control-policy";
import {
  AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
  isAutomaticEnrichmentAndAcquisitionDisabled,
  logBlockedAutomaticAction,
} from "@/lib/discovery/operational-safety";
import {
  getDiscoveryControlSettings,
  recordDiscoveryApifyUsage,
} from "@/lib/discovery/control-center/discovery-control-service";
import { enqueueDiscoveryJob, enqueueEnterpriseAcquisitionJob, isDiscoveryQueueAvailable } from "@/lib/discovery/queue";
import { LOCATION_DISCOVERY_TARGETS } from "@/lib/discovery/types";
import type { DiscoveryJobPayload, DiscoveryPlatform } from "@/lib/discovery/types";
import {
  isDatasetAcquisitionBackfillEnabled,
  isDatasetAcquisitionCompareModeEnabled,
} from "@/lib/discovery/dataset-acquisition-policy";
import { buildGeoTargetedAcquisitionSeeds } from "@/lib/discovery/acquisition-targeting";
import type { IntelligenceSufficiencyEvaluation } from "@/lib/discovery/intelligence-sufficiency";
import { getIntelligenceSufficiencyConfig } from "@/lib/discovery/intelligence-sufficiency";
import {
  buildEnterpriseDiscoveryGateInput,
  evaluateEnterpriseDiscoveryBackfillNeed,
  type EnterpriseDiscoveryGateResult,
} from "@/lib/discovery/enterprise-discovery-gate";
import { checkCipAcquisitionCooldown } from "@/lib/discovery/cip-acquisition-cooldown";
import {
  attachSearchSessionToCoverageAcquisitionJob,
  buildCoverageAcquisitionDedupeKey,
  findActiveCoverageAcquisitionJob,
} from "@/lib/discovery/coverage-acquisition-dedupe";
import { isExactCreatorLookupSearch } from "@/lib/discovery/creator-search-query";

export type CoverageBackfillInput = {
  searchId: string;
  searchSessionId?: string;
  intent: CampaignSearchIntent;
  coverage: DiscoveryCoverageEvaluation;
  intelligence?: IntelligenceSufficiencyEvaluation;
  query: Record<string, unknown>;
};

export type BrowseCoverageBackfillInput = {
  searchId: string;
  searchSessionId?: string;
  filters: UnifiedCreatorBrowseFilters;
  coverage: DiscoveryCoverageEvaluation;
  intelligence?: IntelligenceSufficiencyEvaluation;
  query: Record<string, unknown>;
};

export type CoverageBackfillResult = {
  executed: boolean;
  queued: boolean;
  reason: string;
  jobId?: string;
  /** All acquisition job ids when multiple platforms are enqueued. */
  jobIds?: string[];
  jobPayload?: DiscoveryJobPayload;
  jobPayloads?: DiscoveryJobPayload[];
  profilesAdded?: number;
  acquisitionMode?: "dataset_import" | "legacy_worker";
  acquisitionStarted?: boolean;
  acquisitionJobId?: string;
  acquisitionJobIds?: string[];
  status?: string;
  /** True when at least one request attached to an existing in-flight job. */
  attached?: boolean;
  attachedJobIds?: string[];
  /** Newly created BullMQ/DB jobs (excludes attaches) — used for Apify usage accounting. */
  newlyEnqueuedCount?: number;
  datasetAcquisition?: {
    apifyRunId: string | null;
    datasetId: string | null;
    creatorsImported: number;
    creatorsMerged: number;
    enrichmentJobsQueued: number;
  };
};

export type CoverageBackfillIntent = {
  country?: string;
  city?: string;
  categories?: string[];
  niches?: string[];
  platforms?: string[];
  searchText?: string;
  industry?: string;
};

export type DiscoveryJobWaitResult = {
  status: string;
  profiles_discovered: number;
};

const VALID_PLATFORMS = new Set<DiscoveryPlatform>([
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
]);

function resolveBackfillPlatformsFromList(
  platforms: string[] | undefined
): DiscoveryPlatform[] {
  if (!platforms?.length) return ["instagram"];
  const ordered: DiscoveryPlatform[] = [];
  const seen = new Set<DiscoveryPlatform>();
  for (const raw of platforms) {
    const platform = raw.trim().toLowerCase() as DiscoveryPlatform;
    if (!VALID_PLATFORMS.has(platform) || seen.has(platform)) continue;
    seen.add(platform);
    ordered.push(platform);
  }
  return ordered.length > 0 ? ordered : ["instagram"];
}

function defaultLocationQueryForCountry(countryCode: string | undefined): string | null {
  if (!countryCode?.trim()) return null;
  const target = LOCATION_DISCOVERY_TARGETS.find(
    (entry) => entry.country === countryCode.trim().toUpperCase()
  );
  return target?.queries[0] ?? null;
}

function resolveHashtagSeed(intent: CoverageBackfillIntent): string | null {
  const fromSearch = intent.searchText
    ?.trim()
    .split(/\s+/)
    .map((token) => token.replace(/^#+/, "").toLowerCase())
    .find((token) => token.length > 2 && !/^[a-z]{2}$/.test(token));
  if (fromSearch) return fromSearch;

  const fromCategory = intent.categories?.find((category) => category.trim().length > 1);
  if (fromCategory) return fromCategory.replace(/^#+/, "").toLowerCase();

  const fromIndustry = intent.industry?.trim().split(/\s+/)[0];
  if (fromIndustry && fromIndustry.length > 2) return fromIndustry.toLowerCase();

  return null;
}

export function isInlineDiscoveryBackfillEnabled(): boolean {
  const flag = process.env.DISCOVERY_INLINE_BACKFILL?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  return process.env.NODE_ENV !== "production";
}

function coverageBackfillIntentFromBrowseFilters(
  filters: UnifiedCreatorBrowseFilters
): CoverageBackfillIntent {
  const intent = filters.coverageIntent;
  return {
    country: filters.country ?? intent?.country,
    categories:
      filters.categories ??
      (filters.category ? [filters.category] : undefined) ??
      intent?.categories,
    niches: intent?.niches,
    platforms:
      filters.platforms ??
      (filters.platform ? [filters.platform] : undefined) ??
      intent?.platforms,
    searchText: filters.search ?? intent?.audience,
  };
}

function buildCoverageBackfillJobPayloadForPlatform(
  intent: CoverageBackfillIntent,
  platform: DiscoveryPlatform
): DiscoveryJobPayload {
  const categories = intent.categories ?? [];
  const coverageIntent = {
    industry: intent.industry,
    country: intent.country,
    categories,
    platforms: intent.platforms,
  };

  const geoSeeds = buildGeoTargetedAcquisitionSeeds({
    country: intent.country,
    categories,
    niches: intent.niches,
    audience: intent.searchText,
  });

  if (intent.country?.trim() && geoSeeds.primaryHashtag) {
    const countryCode = intent.country.trim().toUpperCase();
    return {
      method: "location",
      platform,
      locationCountry: countryCode,
      locationQuery: geoSeeds.primaryHashtag,
      hashtag: geoSeeds.primaryHashtag,
      limit: 25,
      triggeredBy: "coverage_miss",
      coverageIntent,
    };
  }

  const hashtagSeed = resolveHashtagSeed(intent);

  if (hashtagSeed) {
    return {
      method: "hashtag",
      platform,
      hashtag: hashtagSeed,
      limit: 25,
      triggeredBy: "coverage_miss",
      coverageIntent,
    };
  }

  if (intent.country) {
    const locationQuery =
      intent.city?.trim() ||
      defaultLocationQueryForCountry(intent.country) ||
      geoSeeds.primaryHashtag ||
      "creator";
    return {
      method: "location",
      platform,
      locationCountry: intent.country,
      locationQuery,
      hashtag: locationQuery.replace(/^#+/, ""),
      limit: 25,
      triggeredBy: "coverage_miss",
      coverageIntent,
    };
  }

  return {
    method: "hashtag",
    platform,
    hashtag: geoSeeds.primaryHashtag || "creator",
    limit: 25,
    triggeredBy: "coverage_miss",
    coverageIntent,
  };
}

/** One Apify acquisition payload per brief platform (e.g. Instagram + TikTok). */
export function buildCoverageBackfillJobPayloadsFromIntent(
  intent: CoverageBackfillIntent
): DiscoveryJobPayload[] {
  return resolveBackfillPlatformsFromList(intent.platforms).map((platform) =>
    buildCoverageBackfillJobPayloadForPlatform(intent, platform)
  );
}

export function buildCoverageBackfillJobPayloadFromIntent(
  intent: CoverageBackfillIntent
): DiscoveryJobPayload {
  return buildCoverageBackfillJobPayloadsFromIntent(intent)[0];
}

export function buildCoverageBackfillJobPayloadsFromBrowseFilters(
  filters: UnifiedCreatorBrowseFilters
): DiscoveryJobPayload[] {
  return buildCoverageBackfillJobPayloadsFromIntent(
    coverageBackfillIntentFromBrowseFilters(filters)
  );
}

export function buildCoverageBackfillJobPayloadFromBrowseFilters(
  filters: UnifiedCreatorBrowseFilters
): DiscoveryJobPayload {
  return buildCoverageBackfillJobPayloadsFromBrowseFilters(filters)[0];
}

export function buildCoverageBackfillJobPayload(
  intent: CampaignSearchIntent
): DiscoveryJobPayload {
  return buildCoverageBackfillJobPayloadFromIntent({
    country: intent.country,
    city: intent.city,
    categories: intent.categories,
    platforms: intent.platforms,
    searchText:
      intent.semanticKeywords[0] ??
      intent.keywords[0] ??
      intent.categories[0] ??
      intent.industry,
    industry: intent.industry,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function discoveryCoverageBackfillWaitMs(): number {
  const raw = process.env.DISCOVERY_COVERAGE_BACKFILL_WAIT_MS?.trim();
  const parsed = raw ? Number(raw) : 45_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45_000;
}

/** Poll discovery_jobs until terminal status or timeout. */
export async function waitForDiscoveryJobCompletion(
  supabase: SupabaseClient,
  jobId: string,
  timeoutMs: number = discoveryCoverageBackfillWaitMs(),
  pollIntervalMs = 1_500
): Promise<DiscoveryJobWaitResult | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("discovery_jobs")
      .select("status, profiles_discovered")
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const status = String(data.status ?? "");
    if (status === "completed" || status === "failed" || status === "cancelled") {
      return {
        status,
        profiles_discovered: Number(data.profiles_discovered ?? 0),
      };
    }

    await sleep(pollIntervalMs);
  }

  return null;
}

async function enqueueCoverageBackfillJob(
  supabase: SupabaseClient,
  input: {
    searchId: string;
    searchSessionId?: string;
    coverage: DiscoveryCoverageEvaluation;
    intelligence?: IntelligenceSufficiencyEvaluation;
    query: Record<string, unknown>;
    jobPayload: DiscoveryJobPayload;
  }
): Promise<CoverageBackfillResult> {
  const coverageDedupeKey = buildCoverageAcquisitionDedupeKey(input.jobPayload);
  const existing = await findActiveCoverageAcquisitionJob(supabase, coverageDedupeKey);
  if (existing) {
    const attached = await attachSearchSessionToCoverageAcquisitionJob(supabase, existing.id, {
      searchSessionId: input.searchSessionId,
      searchId: input.searchId,
    });
    if (attached.attached) {
      return {
        executed: true,
        queued: true,
        attached: true,
        attachedJobIds: [existing.id],
        newlyEnqueuedCount: 0,
        jobId: existing.id,
        jobIds: [existing.id],
        acquisitionStarted: true,
        acquisitionJobId: existing.id,
        acquisitionJobIds: [existing.id],
        status: "Acquiring creators (attached to in-flight job)...",
        acquisitionMode: "legacy_worker",
        reason: `Attached to existing coverage acquisition job ${existing.id} (${coverageDedupeKey}).`,
        jobPayload: input.jobPayload,
      };
    }
  }

  const { data: job, error } = await supabase
    .from("discovery_jobs")
    .insert({
      job_type: `discovery:coverage_backfill:${input.jobPayload.method}`,
      method: input.jobPayload.method,
      status: "pending",
      payload: {
        ...input.jobPayload,
        coverageDedupeKey,
        searchId: input.searchId,
        searchIds: [input.searchId],
        searchSessionId: input.searchSessionId ?? null,
        searchSessionIds: input.searchSessionId?.trim()
          ? [input.searchSessionId.trim()]
          : [],
        coverage: {
          score: input.coverage.coverageScore,
          level: input.coverage.coverageLevel,
          missingReasons: input.coverage.missingReasons,
        },
        intelligence: input.intelligence
          ? {
              sufficiencyScore: input.intelligence.sufficiencyScore,
              sufficiencyLevel: input.intelligence.sufficiencyLevel,
              intelligenceGaps: input.intelligence.intelligenceGaps,
              gapReasons: input.intelligence.gapReasons,
            }
          : null,
        query: input.query,
      },
      created_by: null,
    })
    .select("id")
    .single();

  if (error) {
    return {
      executed: true,
      queued: false,
      newlyEnqueuedCount: 0,
      reason: `Failed to persist discovery job: ${error.message}`,
      jobPayload: input.jobPayload,
    };
  }

  const jobId = job.id as string;
  const queued = await enqueueDiscoveryJob(input.jobPayload, jobId);
  const compareNote = input.query.compareMode ? " (staging compare mode)" : "";
  return {
    executed: true,
    queued: queued.queued,
    newlyEnqueuedCount: queued.queued ? 1 : 0,
    jobId,
    acquisitionStarted: queued.queued,
    acquisitionJobId: queued.queued ? jobId : undefined,
    status: queued.queued ? "Acquiring creators..." : undefined,
    acquisitionMode: "legacy_worker",
    reason: queued.queued
      ? `Legacy discovery-worker backfill enqueued after insufficient coverage${compareNote}.`
      : queued.reason ?? "Queue enqueue failed.",
    jobPayload: input.jobPayload,
  };
}

function resolveBackfillPlatform(jobPayload: DiscoveryJobPayload): DiscoveryPlatform {
  return (jobPayload.platform ?? "instagram") as DiscoveryPlatform;
}

async function enqueueEnterpriseDatasetAcquisition(
  supabase: SupabaseClient,
  input: {
    searchId: string;
    searchSessionId?: string;
    coverage: DiscoveryCoverageEvaluation;
    intelligence?: IntelligenceSufficiencyEvaluation;
    query: Record<string, unknown>;
    jobPayloads: DiscoveryJobPayload[];
  }
): Promise<CoverageBackfillResult> {
  const jobPayloads = input.jobPayloads.filter(Boolean);
  if (jobPayloads.length === 0) {
    return {
      executed: false,
      queued: false,
      reason: "No acquisition payloads to enqueue.",
    };
  }

  if (!isDiscoveryQueueAvailable()) {
    return {
      executed: true,
      queued: false,
      acquisitionMode: "dataset_import",
      reason:
        "REDIS_URL not configured — start discovery-worker with Redis to run enterprise acquisition.",
      jobPayload: jobPayloads[0],
      jobPayloads,
    };
  }

  const jobIds: string[] = [];
  const attachedJobIds: string[] = [];
  const failures: string[] = [];
  let newlyEnqueuedCount = 0;
  let attachedCount = 0;

  for (const jobPayload of jobPayloads) {
    const platform = resolveBackfillPlatform(jobPayload);
    const countryCode =
      jobPayload.coverageIntent?.country ?? jobPayload.locationCountry;
    const categoryTags = jobPayload.coverageIntent?.categories ?? [];
    const coverageDedupeKey = buildCoverageAcquisitionDedupeKey(jobPayload);

    const existing = await findActiveCoverageAcquisitionJob(supabase, coverageDedupeKey);
    if (existing) {
      const attached = await attachSearchSessionToCoverageAcquisitionJob(
        supabase,
        existing.id,
        {
          searchSessionId: input.searchSessionId,
          searchId: input.searchId,
        }
      );
      if (attached.attached) {
        jobIds.push(existing.id);
        attachedJobIds.push(existing.id);
        attachedCount += 1;
        continue;
      }
    }

    const sessionIds = input.searchSessionId?.trim()
      ? [input.searchSessionId.trim()]
      : [];

    const { data: job, error: jobError } = await supabase
      .from("discovery_jobs")
      .insert({
        job_type: `discovery:dataset_acquisition:${jobPayload.method}:${platform}`,
        method: jobPayload.method,
        status: "pending",
        payload: {
          ...jobPayload,
          coverageDedupeKey,
          searchId: input.searchId,
          searchIds: [input.searchId],
          searchSessionId: input.searchSessionId ?? null,
          searchSessionIds: sessionIds,
          campaignIntelligenceProfileId:
            (input.query.campaignIntelligenceProfileId as string | null | undefined) ??
            (input.query.filters as { campaignIntelligenceProfileId?: string } | undefined)
              ?.campaignIntelligenceProfileId ??
            null,
          acquisition_mode: "dataset_import",
          coverage: {
            score: input.coverage.coverageScore,
            level: input.coverage.coverageLevel,
          },
          intelligence: input.intelligence
            ? {
                sufficiencyScore: input.intelligence.sufficiencyScore,
                sufficiencyLevel: input.intelligence.sufficiencyLevel,
                intelligenceGaps: input.intelligence.intelligenceGaps,
                gapReasons: input.intelligence.gapReasons,
                acquisitionHints: input.intelligence.acquisitionHints,
              }
            : null,
          query: input.query,
        },
        created_by: null,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      failures.push(
        `${platform}: failed to persist job (${jobError?.message ?? "unknown"})`
      );
      continue;
    }

    const jobId = job.id as string;
    const queued = await enqueueEnterpriseAcquisitionJob({
      jobId,
      searchId: input.searchId,
      searchSessionId: input.searchSessionId ?? null,
      platform,
      jobPayload,
      countryCode,
      categoryTags,
      intelligence: input.intelligence
        ? {
            acquisitionHints: input.intelligence.acquisitionHints,
            intelligenceGaps: input.intelligence.intelligenceGaps,
            sufficiencyScore: input.intelligence.sufficiencyScore,
            sufficiencyLevel: input.intelligence.sufficiencyLevel,
          }
        : undefined,
    });

    if (!queued.queued) {
      failures.push(`${platform}: ${queued.reason ?? "enqueue failed"}`);
      await supabase
        .from("discovery_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: queued.reason ?? "Failed to enqueue enterprise acquisition job.",
        })
        .eq("id", jobId);
      continue;
    }

    jobIds.push(jobId);
    newlyEnqueuedCount += 1;
  }

  const platformLabels = jobPayloads.map((payload) => payload.platform ?? "instagram").join(", ");
  const handled = newlyEnqueuedCount + attachedCount;
  const queued = handled > 0;
  const attached = attachedCount > 0;

  return {
    executed: true,
    queued,
    attached,
    attachedJobIds: attachedJobIds.length > 0 ? attachedJobIds : undefined,
    newlyEnqueuedCount,
    jobId: jobIds[0],
    jobIds,
    acquisitionStarted: queued,
    acquisitionJobId: jobIds[0],
    acquisitionJobIds: jobIds,
    status: queued
      ? attached && newlyEnqueuedCount === 0
        ? `Acquiring creators (attached to in-flight job for ${platformLabels})...`
        : `Acquiring creators (${platformLabels})...`
      : undefined,
    acquisitionMode: "dataset_import",
    reason:
      attached && newlyEnqueuedCount === 0
        ? `Attached to existing coverage acquisition for ${platformLabels}.`
        : newlyEnqueuedCount === jobPayloads.length
          ? `Enterprise dataset acquisition enqueued for ${platformLabels}.`
          : failures.length > 0
            ? `Enterprise acquisition partially handled (${handled}/${jobPayloads.length}; ${attachedCount} attached): ${failures.join("; ")}`
            : attached
              ? `Enterprise acquisition: ${newlyEnqueuedCount} enqueued, ${attachedCount} attached.`
              : "Enterprise acquisition enqueue failed.",
    jobPayload: jobPayloads[0],
    jobPayloads,
  };
}


function resolveEnterpriseDiscoveryGate(
  coverage: DiscoveryCoverageEvaluation,
  settings: Awaited<ReturnType<typeof getDiscoveryControlSettings>>,
  useIntelligenceGate: boolean,
  intelligence?: IntelligenceSufficiencyEvaluation
): EnterpriseDiscoveryGateResult {
  const minimumCreatorCount = useIntelligenceGate
    ? getIntelligenceSufficiencyConfig(settings).minCreatorCount
    : getDiscoveryCoverageConfig(settings).minCount;

  return evaluateEnterpriseDiscoveryBackfillNeed(
    buildEnterpriseDiscoveryGateInput({
      creatorCount: coverage.breakdown.count,
      minimumCreatorCount,
      coverage,
      coverageThreshold: settings.coverageThreshold,
      useIntelligenceGate,
      intelligence,
    })
  );
}

export function browseFiltersHaveBackfillIntent(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  // Exact @handle / profile URL lookups must never start country/hashtag
  // dataset acquisition (that path scrapes dozens of unrelated creators).
  if (isExactCreatorLookupSearch(filters.search)) return false;

  if (filters.search?.trim()) return true;
  if (filters.country?.trim()) return true;
  if (filters.category?.trim()) return true;
  if (filters.categories?.length) return true;
  if (filters.platform?.trim()) return true;
  if (filters.platforms?.length) return true;
  const intent = filters.coverageIntent;
  if (intent) {
    if (intent.country?.trim()) return true;
    if (intent.categories?.length) return true;
    if (intent.platforms?.length) return true;
    if (intent.audience?.trim()) return true;
  }
  return false;
}

/**
 * Enqueue discovery-worker backfill ONLY when coverage is insufficient.
 * Never runs when coverage is excellent, good, or partial.
 */
export async function maybeTriggerCoverageBackfill(
  supabase: SupabaseClient,
  input: CoverageBackfillInput
): Promise<CoverageBackfillResult> {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    logBlockedAutomaticAction("ai_search_coverage_backfill", AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON, {
      searchId: input.searchId,
    });
    return {
      executed: false,
      queued: false,
      reason: AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
    };
  }

  const settings = await getDiscoveryControlSettings(supabase);
  const useIntelligenceGate = isDatasetAcquisitionBackfillEnabled();
  const gate = resolveEnterpriseDiscoveryGate(
    input.coverage,
    settings,
    useIntelligenceGate,
    input.intelligence
  );

  if (settings.discoverySource === "platform_database_only") {
    return {
      executed: false,
      queued: false,
      reason: "Apify disabled — discovery source is platform_database_only.",
    };
  }

  if (!isApifyLiveOnly(settings) && !gate.needsBackfill) {
    return {
      executed: false,
      queued: false,
      reason: `Apify fallback skipped — ${gate.reason}.`,
    };
  }

  const minimumCreatorCount = useIntelligenceGate
    ? getIntelligenceSufficiencyConfig(settings).minCreatorCount
    : getDiscoveryCoverageConfig(settings).minCount;

  const policyGate = await gateApifyBackfill(supabase, settings, {
    coverage: input.coverage,
    intelligence: input.intelligence,
    useIntelligenceGate,
    meetsThreshold: gate.meetsThreshold,
    creatorCount: input.coverage.breakdown.count,
    minimumCreatorCount,
  });
  if (!policyGate.allowed) {
    return {
      executed: false,
      queued: false,
      reason: policyGate.reason,
    };
  }

  const jobPayloads = buildCoverageBackfillJobPayloadsFromIntent({
    country: input.intent.country,
    city: input.intent.city,
    categories: input.intent.categories,
    platforms: input.intent.platforms,
    searchText:
      input.intent.semanticKeywords[0] ??
      input.intent.keywords[0] ??
      input.intent.categories[0] ??
      input.intent.industry,
    industry: input.intent.industry,
  });

  if (useIntelligenceGate) {
    const result = await enqueueEnterpriseDatasetAcquisition(supabase, {
      searchId: input.searchId,
      searchSessionId: input.searchSessionId,
      coverage: input.coverage,
      intelligence: input.intelligence,
      query: input.query,
      jobPayloads,
    });
    const newRequests = result.newlyEnqueuedCount ?? 0;
    if (result.executed && newRequests > 0) {
      await recordDiscoveryApifyUsage(supabase, { requests: newRequests });
    }
    if (isDatasetAcquisitionCompareModeEnabled() && isDiscoveryQueueAvailable()) {
      void enqueueCoverageBackfillJob(supabase, {
        searchId: input.searchId,
        searchSessionId: input.searchSessionId,
        coverage: input.coverage,
        intelligence: input.intelligence,
        query: { ...input.query, compareMode: true },
        jobPayload: jobPayloads[0],
      });
    }
    return result;
  }

  if (!isDiscoveryQueueAvailable()) {
    return {
      executed: false,
      queued: false,
      reason: "REDIS_URL not configured — backfill job not enqueued.",
    };
  }

  const result = await enqueueCoverageBackfillJob(supabase, {
    searchId: input.searchId,
    searchSessionId: input.searchSessionId,
    coverage: input.coverage,
    intelligence: input.intelligence,
    query: input.query,
    jobPayload: jobPayloads[0],
  });
  const newRequests = result.newlyEnqueuedCount ?? (result.queued && !result.attached ? 1 : 0);
  if (result.executed && newRequests > 0) {
    await recordDiscoveryApifyUsage(supabase, { requests: newRequests });
  }
  return result;
}

/**
 * Discovery UI / browse path — enqueue backfill from unified browse filters.
 */
export async function maybeTriggerBrowseCoverageBackfill(
  supabase: SupabaseClient,
  input: BrowseCoverageBackfillInput
): Promise<CoverageBackfillResult> {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    logBlockedAutomaticAction("browse_coverage_backfill", AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON, {
      searchId: input.searchId,
    });
    return {
      executed: false,
      queued: false,
      reason: AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
    };
  }

  const settings = await getDiscoveryControlSettings(supabase);
  const useIntelligenceGate = isDatasetAcquisitionBackfillEnabled();
  const gate = resolveEnterpriseDiscoveryGate(
    input.coverage,
    settings,
    useIntelligenceGate,
    input.intelligence
  );

  if (settings.discoverySource === "platform_database_only") {
    return {
      executed: false,
      queued: false,
      reason: "Apify disabled — discovery source is platform_database_only.",
    };
  }

  if (!isApifyLiveOnly(settings) && !gate.needsBackfill) {
    return {
      executed: false,
      queued: false,
      reason: `Apify fallback skipped — ${gate.reason}.`,
    };
  }

  const cipCooldown = await checkCipAcquisitionCooldown(
    supabase,
    input.filters.campaignIntelligenceProfileId
  );
  if (cipCooldown.skip) {
    return {
      executed: false,
      queued: false,
      reason: cipCooldown.reason ?? "CIP acquisition cooldown active.",
    };
  }

  const minimumCreatorCount = useIntelligenceGate
    ? getIntelligenceSufficiencyConfig(settings).minCreatorCount
    : getDiscoveryCoverageConfig(settings).minCount;

  const policyGate = await gateApifyBackfill(supabase, settings, {
    coverage: input.coverage,
    intelligence: input.intelligence,
    useIntelligenceGate,
    meetsThreshold: gate.meetsThreshold,
    creatorCount: input.coverage.breakdown.count,
    minimumCreatorCount,
  });
  if (!policyGate.allowed) {
    return {
      executed: false,
      queued: false,
      reason: policyGate.reason,
    };
  }

  const jobPayloads = buildCoverageBackfillJobPayloadsFromBrowseFilters(input.filters);

  if (useIntelligenceGate) {
    const result = await enqueueEnterpriseDatasetAcquisition(supabase, {
      searchId: input.searchId,
      searchSessionId: input.searchSessionId,
      coverage: input.coverage,
      intelligence: input.intelligence,
      query: input.query,
      jobPayloads,
    });
    const newRequests = result.newlyEnqueuedCount ?? 0;
    if (result.executed && newRequests > 0) {
      await recordDiscoveryApifyUsage(supabase, { requests: newRequests });
    }
    if (isDatasetAcquisitionCompareModeEnabled() && isDiscoveryQueueAvailable()) {
      void enqueueCoverageBackfillJob(supabase, {
        searchId: input.searchId,
        searchSessionId: input.searchSessionId,
        coverage: input.coverage,
        intelligence: input.intelligence,
        query: { ...input.query, compareMode: true },
        jobPayload: jobPayloads[0],
      });
    }
    return result;
  }

  if (!isDiscoveryQueueAvailable()) {
    return {
      executed: false,
      queued: false,
      reason:
        "REDIS_URL not configured — start discovery-worker (npm run discovery:worker:dev) to acquire creators in the background.",
    };
  }

  const result = await enqueueCoverageBackfillJob(supabase, {
    searchId: input.searchId,
    searchSessionId: input.searchSessionId,
    coverage: input.coverage,
    intelligence: input.intelligence,
    query: input.query,
    jobPayload: jobPayloads[0],
  });
  const newRequests = result.newlyEnqueuedCount ?? (result.queued && !result.attached ? 1 : 0);
  if (result.executed && newRequests > 0) {
    await recordDiscoveryApifyUsage(supabase, { requests: newRequests });
  }
  return result;
}
