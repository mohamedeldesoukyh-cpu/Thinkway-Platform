import type { SupabaseClient } from "@supabase/supabase-js";

import type { DiscoveryCoverageEvaluation } from "@/lib/creators/discovery-coverage";
import { getDiscoveryCoverageConfig } from "@/lib/creators/discovery-coverage";
import type { IntelligenceSufficiencyEvaluation } from "@/lib/discovery/intelligence-sufficiency";
import { getIntelligenceSufficiencyConfig } from "@/lib/discovery/intelligence-sufficiency";
import {
  buildEnterpriseDiscoveryGateInput,
  evaluateEnterpriseDiscoveryBackfillNeed,
} from "@/lib/discovery/enterprise-discovery-gate";
import type {
  UnifiedCreatorBrowseFilters,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import type { EnrichmentTrigger } from "@/lib/creator-enrichment/types";

import {
  AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
  isAutomaticEnrichmentAndAcquisitionDisabled,
  logBlockedAutomaticAction,
} from "@/lib/discovery/operational-safety";

import { assertApifyAcquisitionBudget } from "./apify-budget";
import {
  getCachedDiscoveryControlSettings,
  getDiscoveryControlSettings,
} from "./discovery-control-service";
import type { DiscoveryControlSettings } from "./discovery-control-types";

export type ApifyGateContext = {
  coverage?: DiscoveryCoverageEvaluation;
  intelligence?: IntelligenceSufficiencyEvaluation;
  meetsThreshold?: boolean;
  useIntelligenceGate?: boolean;
  creatorCount?: number;
  minimumCreatorCount?: number;
};

export function getCoverageThreshold(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): number {
  return settings.coverageThreshold;
}

export function isPlatformDatabaseOnly(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    return true;
  }
  return settings.discoverySource === "platform_database_only";
}

export function isApifyLiveOnly(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    return false;
  }
  return settings.discoverySource === "apify_live_only";
}

export function shouldSkipDatabaseBrowse(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    return false;
  }
  return (
    settings.discoverySource === "apify_live_only" &&
    settings.searchPriority === "apify_first"
  );
}

export function applyPolicyToBrowse(
  filters: UnifiedCreatorBrowseFilters,
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): UnifiedCreatorBrowseFilters {
  if (isPlatformDatabaseOnly(settings)) {
    // DB-only / auto-acquisition-off: stay on influencers inventory (internal +
    // imported + oauth). Do not pull unlinked public_discovery or call Apify.
    // Hydration treats source "internal" as all platform-DB provenance types.
    return {
      ...filters,
      source: filters.source && filters.source !== "all" ? filters.source : "internal",
      skipCoverageBackfill: true,
    };
  }

  if (shouldSkipDatabaseBrowse(settings)) {
    return filters;
  }

  return filters;
}

export function shouldCallApify(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings(),
  context?: ApifyGateContext
): boolean {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    return false;
  }

  if (settings.discoverySource === "platform_database_only") {
    return false;
  }

  if (settings.discoverySource === "apify_live_only") {
    return true;
  }

  const coverage = context?.coverage;
  if (!coverage) return false;

  const useIntelligenceGate = context?.useIntelligenceGate ?? false;
  const creatorCount =
    context?.creatorCount ??
    coverage.breakdown.count ??
    context?.intelligence?.breakdown.matchingCreatorCount ??
    0;
  const minimumCreatorCount =
    context?.minimumCreatorCount ??
    (useIntelligenceGate
      ? getIntelligenceSufficiencyConfig(settings).minCreatorCount
      : getDiscoveryCoverageConfig(settings).minCount);

  const gate = evaluateEnterpriseDiscoveryBackfillNeed(
    buildEnterpriseDiscoveryGateInput({
      creatorCount,
      minimumCreatorCount,
      coverage,
      coverageThreshold: settings.coverageThreshold,
      useIntelligenceGate,
      intelligence: context?.intelligence,
    })
  );

  return gate.needsBackfill;
}

/**
 * Fail-closed daily Apify budget check.
 * Budget 0 / undefined / missing rejects acquisition — never treated as unlimited.
 */
export async function isApifyUsageWithinLimits(
  supabase: SupabaseClient,
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): Promise<{ allowed: boolean; reason?: string }> {
  const decision = await assertApifyAcquisitionBudget(supabase, {
    settings,
    source: "isApifyUsageWithinLimits",
  });
  return {
    allowed: decision.allowed,
    reason: decision.reason,
  };
}

export async function gateApifyBackfill(
  supabase: SupabaseClient,
  settings: DiscoveryControlSettings,
  context?: ApifyGateContext
): Promise<{ allowed: boolean; reason: string }> {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    logBlockedAutomaticAction("coverage_apify_backfill", AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON, {
      creatorCount: context?.creatorCount ?? null,
      coverageLevel: context?.coverage?.coverageLevel ?? null,
    });
    return {
      allowed: false,
      reason: AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
    };
  }

  if (!shouldCallApify(settings, context)) {
    if (settings.discoverySource === "platform_database_only") {
      return {
        allowed: false,
        reason: "Apify disabled — discovery source is platform_database_only.",
      };
    }
    const level = context?.coverage?.coverageLevel ?? "unknown";
    return {
      allowed: false,
      reason: `Apify fallback skipped — coverage level is ${level}.`,
    };
  }

  const costGate = await assertApifyAcquisitionBudget(supabase, {
    settings,
    source: "coverage_apify_backfill",
    meta: {
      creatorCount: context?.creatorCount ?? null,
      coverageLevel: context?.coverage?.coverageLevel ?? null,
    },
  });
  if (!costGate.allowed) {
    return {
      allowed: false,
      reason: costGate.reason ?? "Apify cost protection limit reached.",
    };
  }

  return { allowed: true, reason: "Apify backfill permitted by discovery control policy." };
}

export function shouldAutoEnrichForTrigger(
  trigger: EnrichmentTrigger,
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
    logBlockedAutomaticAction("automatic_creator_enrichment", AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON, {
      trigger,
    });
    return false;
  }
  const mode = settings.automaticEnrichment;
  if (mode === "never") return false;
  if (mode === "always") return true;
  if (mode === "shortlisted") return trigger === "shortlist";
  if (mode === "before_proposal") {
    return trigger === "shortlist" || trigger === "campaign";
  }
  return false;
}

export function isDnaGenerateAfterImportEnabled(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  return settings.dnaPolicy.generateAfterImport;
}

export function isDnaUpdateAfterEnrichmentEnabled(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  return settings.dnaPolicy.updateAfterEnrichment;
}

export function isDnaCompletenessCalculationEnabled(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  return settings.dnaPolicy.calculateCompleteness;
}

function resolveCreatorDataAgeDays(creator: UnifiedCreatorResult): number | null {
  const raw = creator.last_enriched_at;
  if (!raw) return null;
  const enrichedAt = new Date(raw);
  if (Number.isNaN(enrichedAt.getTime())) return null;
  const diffMs = Date.now() - enrichedAt.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function applyDataFreshnessFlags(
  creators: UnifiedCreatorResult[],
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): UnifiedCreatorResult[] {
  const maxDays = settings.dataFreshnessDays;
  if (maxDays == null) return creators;

  return creators.map((creator) => {
    const dataAgeDays = resolveCreatorDataAgeDays(creator);
    const outdated =
      dataAgeDays == null || dataAgeDays > maxDays;
    if (!outdated) return creator;

    return {
      ...creator,
      browse_metadata: {
        ...(creator.browse_metadata ?? {}),
        data_may_be_outdated: true,
        data_age_days: dataAgeDays,
      },
    };
  });
}

export async function loadDiscoveryControlPolicy(
  supabase?: SupabaseClient
): Promise<DiscoveryControlSettings> {
  return getDiscoveryControlSettings(supabase);
}
