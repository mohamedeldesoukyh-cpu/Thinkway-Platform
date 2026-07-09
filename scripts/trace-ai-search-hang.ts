/**
 * Read-only runtime timeline for post-coverage async path (AI Search hang investigation).
 * Usage: npx tsx scripts/trace-ai-search-hang.ts
 */
import "@/lib/performance/script-env-preload";

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import {
  buildCreatorFiltersFromProfile,
  buildSearchStrategyFromProfile,
} from "@/features/campaign-intelligence-profile/services/search-strategy";
import { normalizeFromProfile } from "@/features/campaign-intelligence-profile/services/normalization";
import {
  createEmptyCampaignIntelligenceProfile,
  type CampaignIntelligenceProfile,
} from "@/features/campaign-intelligence-profile/types/profile";
import { filtersToBrowseParams } from "@/features/discovery/components/creator-search/creator-search-types";
import {
  evaluateDiscoveryCoverage,
  getDiscoveryCoverageConfig,
} from "@/lib/creators/discovery-coverage";
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import {
  browseFiltersHaveBackfillIntent,
  discoveryCoverageBackfillWaitMs,
  maybeTriggerBrowseCoverageBackfill,
  waitForDiscoveryJobCompletion,
} from "@/lib/discovery/coverage-backfill";
import {
  buildEnterpriseDiscoveryGateInput,
  evaluateEnterpriseDiscoveryBackfillNeed,
} from "@/lib/discovery/enterprise-discovery-gate";
import {
  evaluateIntelligenceSufficiency,
  getIntelligenceSufficiencyConfig,
} from "@/lib/discovery/intelligence-sufficiency";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import {
  isApifyLiveOnly,
  shouldSkipDatabaseBrowse,
} from "@/lib/discovery/control-center/discovery-control-policy";
import { isDatasetAcquisitionBackfillEnabled } from "@/lib/discovery/dataset-acquisition-policy";
import { isDiscoveryQueueAvailable } from "@/lib/discovery/queue";

function ts(label: string, t0: number, extra?: Record<string, unknown>) {
  const elapsed = Date.now() - t0;
  console.log(JSON.stringify({ event: label, elapsed_ms: elapsed, ...extra }));
  return Date.now();
}

function lorealFilters() {
  const raw: CampaignIntelligenceProfile = {
    ...createEmptyCampaignIntelligenceProfile(),
    brandName: "L'Oréal Paris",
    platforms: ["instagram", "tiktok"],
    market: "Egypt",
    audienceDetail: { gender: "Female", ageMin: 25, ageMax: 45, countries: ["EG"] },
    creatorCategories: ["Beauty", "20k-500k followers"],
    creatorNiches: ["skincare", "vitamin c"],
    sources: { geography: "brief", platforms: "brief", audience: "brief", brandName: "brief" },
    confidence: { geography: 0.9, platforms: 0.9, audience: 0.88, brandName: 0.9 },
  };
  const profile = normalizeFromProfile(raw).profile;
  const criteria = buildSearchStrategyFromProfile(profile);
  return filtersToBrowseParams(buildCreatorFiltersFromProfile(profile, criteria), 1, 50);
}

async function main() {
  const t0 = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);
  const filters = lorealFilters();
  const searchId = randomUUID();

  let t = t0;
  t = ts("trace_start", t0, {
    DATASET_ACQUISITION_BACKFILL: process.env.DATASET_ACQUISITION_BACKFILL ?? "(unset)",
    isDatasetAcquisitionBackfillEnabled: isDatasetAcquisitionBackfillEnabled(),
    REDIS_URL_set: Boolean(process.env.REDIS_URL),
    isDiscoveryQueueAvailable: isDiscoveryQueueAvailable(),
    DISCOVERY_COVERAGE_BACKFILL_WAIT_MS: discoveryCoverageBackfillWaitMs(),
    DATASET_ACQUISITION_TIMEOUT_MS: process.env.DATASET_ACQUISITION_TIMEOUT_MS ?? "(default 45000)",
  });

  const settings = await getDiscoveryControlSettings(supabase);
  t = ts("getDiscoveryControlSettings_done", t);

  const skipDatabase = shouldSkipDatabaseBrowse(settings);
  const browseResult = skipDatabase
    ? { creators: [], total: 0, page: 1, pageSize: 50, internal_count: 0, discovery_count: 0 }
    : await browseUnifiedCreators(supabase, filters, "discovery");
  t = ts("first_browseUnifiedCreators_done", t, {
    creatorCount: browseResult.creators.length,
    total: browseResult.total,
    coverageScore: browseResult.coverage?.coverageScore,
  });

  const coverageConfig = getDiscoveryCoverageConfig(settings);
  const intelligenceConfig = getIntelligenceSufficiencyConfig(settings);
  const useIntelligenceGate = isDatasetAcquisitionBackfillEnabled();

  const coverage =
    browseResult.coverage ??
    evaluateDiscoveryCoverage(browseResult, filters.coverageIntent ?? {}, coverageConfig);
  t = ts("coverage_evaluation_done", t, {
    score: coverage.coverageScore,
    level: coverage.coverageLevel,
    count: coverage.breakdown.count,
  });

  const intelligence = evaluateIntelligenceSufficiency(
    browseResult,
    filters.coverageIntent ?? {},
    intelligenceConfig,
    settings
  );
  t = ts("intelligence_evaluation_done", t, {
    sufficient: intelligence.sufficient,
    acquisitionRequired: intelligence.acquisitionRequired,
  });

  const enterpriseGate = evaluateEnterpriseDiscoveryBackfillNeed(
    buildEnterpriseDiscoveryGateInput({
      creatorCount: browseResult.creators.length,
      minimumCreatorCount: useIntelligenceGate
        ? intelligenceConfig.minCreatorCount
        : coverageConfig.minCount,
      coverage,
      coverageThreshold: settings.coverageThreshold,
      useIntelligenceGate,
      intelligence,
    })
  );
  t = ts("enterprise_gate_done", t, enterpriseGate);

  const forceApifyLive = isApifyLiveOnly(settings);
  const needsBackfill =
    browseFiltersHaveBackfillIntent(filters) &&
    (forceApifyLive || enterpriseGate.needsBackfill);
  t = ts("needsBackfill_resolved", t, { needsBackfill, forceApifyLive });

  if (!needsBackfill) {
    ts("trace_end_no_backfill", t0);
    return;
  }

  t = ts("maybeTriggerBrowseCoverageBackfill_start", t);
  const backfill = await maybeTriggerBrowseCoverageBackfill(supabase, {
    searchId,
    filters,
    coverage,
    intelligence,
    query: { mode: "discovery", filters, traceHang: true },
  });
  t = ts("maybeTriggerBrowseCoverageBackfill_done", t, {
    executed: backfill.executed,
    queued: backfill.queued,
    jobId: backfill.jobId,
    profilesAdded: backfill.profilesAdded,
    acquisitionMode: backfill.acquisitionMode,
    reason: backfill.reason?.slice(0, 200),
  });

  let completed = false;
  let profilesAdded = 0;
  let waitedMs = 0;

  if (backfill.queued && backfill.jobId) {
    t = ts("waitForDiscoveryJobCompletion_start", t, {
      jobId: backfill.jobId,
      timeoutMs: discoveryCoverageBackfillWaitMs(),
    });
    const waitStarted = Date.now();
    const job = await waitForDiscoveryJobCompletion(
      supabase,
      backfill.jobId,
      discoveryCoverageBackfillWaitMs()
    );
    waitedMs = Date.now() - waitStarted;
    completed = job?.status === "completed";
    profilesAdded = job?.profiles_discovered ?? 0;
    t = ts("waitForDiscoveryJobCompletion_done", t, {
      jobStatus: job?.status ?? "null_timeout",
      profilesAdded,
      waitedMs,
    });
  } else if (backfill.executed && (backfill.profilesAdded ?? 0) > 0) {
    completed = true;
    profilesAdded = backfill.profilesAdded ?? 0;
    t = ts("inline_backfill_profiles_added", t, { profilesAdded });
  } else if (
    backfill.executed &&
    backfill.acquisitionMode === "dataset_import" &&
    !backfill.queued
  ) {
    completed = (backfill.profilesAdded ?? 0) > 0;
    profilesAdded = backfill.profilesAdded ?? 0;
    t = ts("dataset_import_branch_resolved", t, { completed, profilesAdded });
  }

  if (completed || profilesAdded > 0) {
    t = ts("second_browseUnifiedCreators_start", t);
    const second = await browseUnifiedCreators(supabase, filters, "discovery");
    t = ts("second_browseUnifiedCreators_done", t, {
      creatorCount: second.creators.length,
      total: second.total,
    });
  } else {
    t = ts("second_browse_SKIPPED", t, {
      reason:
        "orchestrator only re-browses when job completed or profilesAdded > 0",
      completed,
      profilesAdded,
      queued: backfill.queued,
      acquisitionMode: backfill.acquisitionMode,
    });
  }

  ts("trace_end", t0, { total_ms: Date.now() - t0 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
