import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  evaluateDiscoveryCoverage,
  getDiscoveryCoverageConfig,
} from "@/lib/creators/discovery-coverage";
import {
  evaluateIntelligenceSufficiency,
  getIntelligenceSufficiencyConfig,
} from "@/lib/discovery/intelligence-sufficiency";
import { isDatasetAcquisitionBackfillEnabled } from "@/lib/discovery/dataset-acquisition-policy";
import {
  buildEnterpriseDiscoveryGateInput,
  evaluateEnterpriseDiscoveryBackfillNeed,
} from "@/lib/discovery/enterprise-discovery-gate";
import { writeDiscoveryCoverageDecision } from "@/lib/creators/discovery-coverage-audit";
import { evaluateIntelligenceCoverage } from "@/lib/creator-intelligence/coverage";
import { getCreatorIntelligenceMode } from "@/lib/creator-intelligence/flags";
import { resolveCreatorIntelligenceBatch } from "@/lib/creator-intelligence/resolver";
import { searchTrace, type SearchTracePath } from "@/lib/creators/search-trace";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";
import {
  browseUnifiedCreators,
} from "@/lib/creators/unified-browse";
import {
  isApifyLiveOnly,
  shouldSkipDatabaseBrowse,
} from "@/lib/discovery/control-center/discovery-control-policy";
import { getDiscoveryControlSettings, getCachedDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import {
  browseFiltersHaveBackfillIntent,
  maybeTriggerBrowseCoverageBackfill,
} from "@/lib/discovery/coverage-backfill";
import { checkCipAcquisitionCooldown } from "@/lib/discovery/cip-acquisition-cooldown";
import {
  AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
  isAutomaticEnrichmentAndAcquisitionDisabled,
  logBlockedAutomaticAction,
} from "@/lib/discovery/operational-safety";
import type { DiscoveryBrowseBackfillMeta, DiscoveryBrowseWithBackfillResult } from "@/lib/discovery/types";

export type { DiscoveryBrowseBackfillMeta, DiscoveryBrowseWithBackfillResult };

/**
 * Database-first browse with coverage evaluation and async enterprise acquisition.
 * Returns immediately after enqueueing background acquisition (no synchronous wait).
 */
export async function browseUnifiedCreatorsWithCoverageBackfill(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  tracePath: Extract<SearchTracePath, "discovery" | "ai"> = "discovery"
): Promise<DiscoveryBrowseWithBackfillResult> {
  const startedAt = Date.now();
  const searchId = randomUUID();
  const page = Math.max(1, filters.page ?? 1);
  const shouldEvaluate = page === 1 && browseFiltersHaveBackfillIntent(filters);
  const settings = shouldEvaluate
    ? await getDiscoveryControlSettings(supabase)
    : getCachedDiscoveryControlSettings();
  const coverageConfig = getDiscoveryCoverageConfig(settings);
  const intelligenceConfig = getIntelligenceSufficiencyConfig(settings);
  const useIntelligenceGate = isDatasetAcquisitionBackfillEnabled();
  const skipDatabase = shouldSkipDatabaseBrowse(settings);

  const browseResult = skipDatabase
    ? {
        creators: [],
        total: 0,
        page,
        pageSize: Math.min(50, filters.pageSize ?? 20),
        internal_count: 0,
        discovery_count: 0,
      }
    : await browseUnifiedCreators(supabase, filters, tracePath);

  let coverage =
    browseResult.coverage ??
    (shouldEvaluate
      ? evaluateDiscoveryCoverage(
          browseResult,
          filters.coverageIntent ?? {},
          coverageConfig
        )
      : undefined);

  // Creator Intelligence rollout (Phase F telemetry): measure INTELLIGENCE
  // coverage of the returned pool next to the legacy coverage decision, so the
  // acquisition gate can migrate from "raw column empty" to "intelligence gap".
  // Shadow/on only; no behavioral change to the gate yet.
  if (shouldEvaluate && getCreatorIntelligenceMode() !== "off" && browseResult.creators.length > 0) {
    try {
      const ciCoverage = evaluateIntelligenceCoverage(
        resolveCreatorIntelligenceBatch(browseResult.creators)
      );
      searchTrace(
        "coverage_ci_shadow",
        {
          categories: ciCoverage.categories,
          languages: ciCoverage.languages,
          audienceCountry: ciCoverage.audienceCountry,
          brandSafety: ciCoverage.brandSafety,
          byPlatform: ciCoverage.byPlatform,
        },
        { path: tracePath }
      );
    } catch {
      // Telemetry must never break the browse path.
    }
  }

  const intelligence =
    shouldEvaluate && coverage
      ? evaluateIntelligenceSufficiency(
          browseResult,
          filters.coverageIntent ?? {},
          intelligenceConfig,
          settings
        )
      : undefined;

  let backfillMeta: DiscoveryBrowseBackfillMeta | undefined;
  const minimumCreatorCount = useIntelligenceGate
    ? intelligenceConfig.minCreatorCount
    : coverageConfig.minCount;
  const enterpriseGate =
    shouldEvaluate && coverage
      ? evaluateEnterpriseDiscoveryBackfillNeed(
          buildEnterpriseDiscoveryGateInput({
            creatorCount: browseResult.creators.length,
            minimumCreatorCount,
            coverage,
            coverageThreshold: settings.coverageThreshold,
            useIntelligenceGate,
            intelligence,
          })
        )
      : { needsBackfill: false, meetsThreshold: true, reason: "sufficient" as const };
  const meetsThreshold = enterpriseGate.meetsThreshold;
  const forceApifyLive = isApifyLiveOnly(settings) && shouldEvaluate;

  const cipCooldown =
    shouldEvaluate && filters.campaignIntelligenceProfileId
      ? await checkCipAcquisitionCooldown(supabase, filters.campaignIntelligenceProfileId)
      : { skip: false as const };

  const wouldNeedBackfill =
    !filters.skipCoverageBackfill &&
    !cipCooldown.skip &&
    shouldEvaluate &&
    (forceApifyLive || enterpriseGate.needsBackfill);

  if (wouldNeedBackfill && isAutomaticEnrichmentAndAcquisitionDisabled()) {
    logBlockedAutomaticAction("browse_coverage_backfill_orchestrator", AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON, {
      searchId,
      creatorCount: browseResult.creators.length,
    });
  }

  const needsBackfill =
    wouldNeedBackfill && !isAutomaticEnrichmentAndAcquisitionDisabled();

  if (needsBackfill) {
    const backfillCoverage =
      coverage ??
      evaluateDiscoveryCoverage(
        browseResult,
        filters.coverageIntent ?? {},
        coverageConfig
      );

    const backfill = await maybeTriggerBrowseCoverageBackfill(supabase, {
      searchId,
      searchSessionId: filters.searchSessionId,
      filters,
      coverage: backfillCoverage,
      intelligence,
      query: {
        mode: tracePath,
        filters,
        campaignIntelligenceProfileId: filters.campaignIntelligenceProfileId ?? null,
      },
    });

    const acquisitionStarted = Boolean(
      backfill.acquisitionStarted ?? (backfill.executed && backfill.queued && backfill.jobId)
    );

    backfillMeta = {
      searchId,
      acquisitionStarted,
      acquisitionJobId: backfill.acquisitionJobId ?? backfill.jobId,
      acquisitionJobIds: backfill.acquisitionJobIds ?? backfill.jobIds,
      status: acquisitionStarted ? backfill.status ?? "Acquiring creators..." : undefined,
      apifyExecuted: acquisitionStarted,
      queued: backfill.queued,
      completed: false,
      jobId: backfill.jobId,
      profilesAdded: 0,
      reason: backfill.reason,
      waitedMs: 0,
      acquisitionMode: backfill.acquisitionMode,
      intelligenceSufficiency: intelligence
        ? {
            sufficient: intelligence.sufficient,
            sufficiencyScore: intelligence.sufficiencyScore,
            sufficiencyLevel: intelligence.sufficiencyLevel,
            intelligenceGaps: intelligence.intelligenceGaps,
            gapReasons: intelligence.gapReasons,
          }
        : undefined,
      datasetAcquisition: backfill.datasetAcquisition,
    };
    if (!coverage) {
      coverage = backfillCoverage;
    }
  }

  if (shouldEvaluate && coverage) {
    const durationMs = Date.now() - startedAt;
    const auditReason = cipCooldown.skip
      ? "cip_acquisition_cooldown_skipped"
      : backfillMeta?.acquisitionStarted
      ? useIntelligenceGate
        ? "intelligence_insufficient_dataset_acquisition_enqueued"
        : "db_insufficient_apify_enqueued"
      : useIntelligenceGate && intelligence?.acquisitionRequired
        ? "intelligence_insufficient_acquisition_skipped"
        : enterpriseGate.reason === "low_creator_count"
          ? "db_zero_creators_apify_skipped"
          : coverage?.coverageLevel === "insufficient"
            ? "db_insufficient_apify_skipped"
            : meetsThreshold
              ? "intelligence_sufficient"
              : "db_partial";

    await writeDiscoveryCoverageDecision(supabase, {
      searchId,
      searchQuery: {
        mode: tracePath,
        filters,
        campaignIntelligenceProfileId: filters.campaignIntelligenceProfileId ?? null,
        backfill: backfillMeta ?? null,
        cipCooldownSkipped: cipCooldown.skip ? cipCooldown.reason : null,
      },
      coverage,
      databaseCreatorsCount: browseResult.creators.length,
      apifyExecuted: backfillMeta?.acquisitionStarted ?? false,
      reason: cipCooldown.skip
        ? cipCooldown.reason ?? auditReason
        : backfillMeta?.reason ?? auditReason,
      durationMs,
    });
  }

  return {
    ...browseResult,
    coverage,
    backfill: backfillMeta,
  };
}
