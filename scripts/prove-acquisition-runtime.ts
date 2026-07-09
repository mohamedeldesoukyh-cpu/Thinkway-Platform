/**
 * Read-only runtime proof of Enterprise Discovery acquisition rail.
 * Does NOT modify lib/ product code.
 * Usage: npx tsx scripts/prove-acquisition-runtime.ts
 */
import "@/lib/performance/script-env-preload";

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
import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import {
  evaluateDiscoveryCoverage,
  getDiscoveryCoverageConfig,
} from "@/lib/creators/discovery-coverage";
import {
  buildCoverageBackfillJobPayloadFromBrowseFilters,
  maybeTriggerBrowseCoverageBackfill,
} from "@/lib/discovery/coverage-backfill";
import { browseUnifiedCreatorsWithCoverageBackfill } from "@/lib/discovery/coverage-backfill-orchestrator";
import {
  isDatasetAcquisitionBackfillEnabled,
  isDatasetAcquisitionCompareModeEnabled,
} from "@/lib/discovery/dataset-acquisition-policy";
import {
  buildEnterpriseDiscoveryGateInput,
  evaluateEnterpriseDiscoveryBackfillNeed,
} from "@/lib/discovery/enterprise-discovery-gate";
import {
  evaluateIntelligenceSufficiency,
  getIntelligenceSufficiencyConfig,
} from "@/lib/discovery/intelligence-sufficiency";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import { isDiscoveryQueueAvailable } from "@/lib/discovery/queue";

function classifyJobOrigin(
  jobType: string,
  payload: Record<string, unknown> | null
): string {
  if (!payload) return "unknown";
  if (payload.inline === true) return "inline_backfill_dev";
  if (jobType.includes("dataset_acquisition")) return "enterprise_dataset_acquisition";
  if (jobType.includes("coverage_backfill")) return "enterprise_discovery_ai_search";
  if (jobType.includes("inline_backfill")) return "inline_backfill";
  if (jobType.startsWith("discovery:hashtag") || jobType.startsWith("discovery:location")) {
    return payload.created_by ? "discovery_workspace_manual" : "manual_discovery";
  }
  if (jobType.includes("enrichment")) return "creator_enrichment";
  return "other";
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);

  console.log("=== 1. RUNTIME FLAGS (same env loader as trace scripts / Next via .env*) ===");
  const flagRaw = process.env.DATASET_ACQUISITION_BACKFILL;
  const compareRaw = process.env.DATASET_ACQUISITION_COMPARE;
  const enabled = isDatasetAcquisitionBackfillEnabled();
  const compare = isDatasetAcquisitionCompareModeEnabled();
  console.log(JSON.stringify({
    DATASET_ACQUISITION_BACKFILL_raw: flagRaw ?? "(unset)",
    DATASET_ACQUISITION_COMPARE_raw: compareRaw ?? "(unset)",
    isDatasetAcquisitionBackfillEnabled: enabled,
    isDatasetAcquisitionCompareModeEnabled: compare,
    REDIS_URL_set: Boolean(process.env.REDIS_URL),
    isDiscoveryQueueAvailable: isDiscoveryQueueAvailable(),
    APIFY_TOKEN_set: Boolean(process.env.APIFY_TOKEN),
  }, null, 2));

  console.log("\n=== 2. BRANCH PREDICTION (maybeTriggerBrowseCoverageBackfill logic) ===");
  if (enabled) {
    console.log("useIntelligenceGate=TRUE → will call runDatasetAcquisitionCoverageBackfill()");
    if (compare && isDiscoveryQueueAvailable()) {
      console.log("PLUS DATASET_ACQUISITION_COMPARE=true → ALSO enqueueCoverageBackfillJob() shadow worker job");
    } else {
      console.log("will NOT call enqueueCoverageBackfillJob() unless compare mode on");
    }
  } else {
    console.log("useIntelligenceGate=FALSE → will call enqueueCoverageBackfillJob() OR inline backfill");
    console.log("will NOT call runDatasetAcquisitionCoverageBackfill()");
  }

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
  const browseFilters = filtersToBrowseParams(
    buildCreatorFiltersFromProfile(profile, criteria),
    1,
    50
  );
  const jobPayload = buildCoverageBackfillJobPayloadFromBrowseFilters(browseFilters);

  const settings = await getDiscoveryControlSettings(supabase);
  const coverageConfig = getDiscoveryCoverageConfig(settings);
  const intelligenceConfig = getIntelligenceSufficiencyConfig(settings);
  const pre = await browseUnifiedCreators(supabase, browseFilters, "discovery");
  const coverage =
    pre.coverage ??
    evaluateDiscoveryCoverage(pre, browseFilters.coverageIntent ?? {}, coverageConfig);
  const intelligence = evaluateIntelligenceSufficiency(
    pre,
    browseFilters.coverageIntent ?? {},
    intelligenceConfig,
    settings
  );
  const gate = evaluateEnterpriseDiscoveryBackfillNeed(
    buildEnterpriseDiscoveryGateInput({
      creatorCount: pre.creators.length,
      minimumCreatorCount: enabled
        ? intelligenceConfig.minCreatorCount
        : coverageConfig.minCount,
      coverage,
      coverageThreshold: settings.coverageThreshold,
      useIntelligenceGate: enabled,
      intelligence,
    })
  );

  console.log("\n=== 3. ENTERPRISE GATE ===");
  console.log(JSON.stringify({ creatorCount: pre.creators.length, gate }, null, 2));

  const searchIdDirect = crypto.randomUUID();
  const t0 = Date.now();
  const backfill = await maybeTriggerBrowseCoverageBackfill(supabase, {
    searchId: searchIdDirect,
    filters: browseFilters,
    coverage,
    intelligence,
    query: { mode: "discovery", filters: browseFilters, proveTrace: true },
  });
  const t1 = Date.now();

  console.log("\n=== 4. maybeTriggerBrowseCoverageBackfill() RESULT (runtime proof) ===");
  console.log(JSON.stringify({
    search_id: searchIdDirect,
    job_id: backfill.jobId ?? null,
    acquisitionMode: backfill.acquisitionMode ?? null,
    executed: backfill.executed,
    queued: backfill.queued,
    queue_name: backfill.queued ? "discovery-run" : null,
    profilesAdded: backfill.profilesAdded ?? 0,
    reason: backfill.reason,
    duration_ms: t1 - t0,
    runDatasetAcquisitionCoverageBackfill_called: backfill.acquisitionMode === "dataset_import",
    enqueueCoverageBackfillJob_called:
      backfill.acquisitionMode === "legacy_worker" || backfill.queued === true,
    datasetId: backfill.datasetAcquisition?.datasetId ?? null,
    apifyRunId: backfill.datasetAcquisition?.apifyRunId ?? null,
    jobPayload_method: jobPayload.method,
    jobPayload_hashtag: jobPayload.hashtag,
  }, null, 2));

  console.log("\n=== 5. FULL UI PATH browseUnifiedCreatorsWithCoverageBackfill() ===");
  const t2 = Date.now();
  const full = await browseUnifiedCreatorsWithCoverageBackfill(supabase, browseFilters, "discovery");
  const t3 = Date.now();
  console.log(JSON.stringify({
    search_id: full.backfill?.searchId,
    job_id: full.backfill?.jobId,
    acquisitionMode: full.backfill?.acquisitionMode,
    queued: full.backfill?.queued,
    queue_name: full.backfill?.queued ? "discovery-run" : null,
    apifyExecuted: full.backfill?.apifyExecuted,
    completed: full.backfill?.completed,
    profilesAdded: full.backfill?.profilesAdded,
    reason: full.backfill?.reason,
    duration_ms: t3 - t2,
  }, null, 2));

  console.log("\n=== 6. STATIC CALL STACK → discovery-run (Enterprise AI search, flag=false) ===");
  console.log(`browseUnifiedCreatorsAction
  → browseUnifiedCreatorsWithCoverageBackfill (coverage-backfill-orchestrator.ts)
  → maybeTriggerBrowseCoverageBackfill (coverage-backfill.ts:538)
  → [DATASET_ACQUISITION_BACKFILL=false] enqueueCoverageBackfillJob (coverage-backfill.ts:257)
  → enqueueDiscoveryJob (queue.ts:21)
  → Queue.add("discovery-run", payload, jobId)  // BullMQ queue name: discovery-run
  → discovery.worker.ts consumes QUEUES.discovery`);

  const { data: jobs } = await supabase
    .from("discovery_jobs")
    .select("id, job_type, method, status, payload, result, created_at, started_at, completed_at, profiles_discovered, error_message, created_by")
    .order("created_at", { ascending: false })
    .limit(15);

  console.log("\n=== 7. RECENT discovery_jobs (correlate worker + Apify console) ===");
  for (const j of jobs ?? []) {
    const p = (j.payload ?? null) as Record<string, unknown> | null;
    const r = (j.result ?? null) as Record<string, unknown> | null;
    const q = (p?.query ?? null) as Record<string, unknown> | null;
    console.log(JSON.stringify({
      job_id: j.id,
      search_id: p?.searchId ?? null,
      job_type: j.job_type,
      method: j.method,
      status: j.status,
      origin: classifyJobOrigin(String(j.job_type), p),
      acquisition_mode: r?.acquisition_mode ?? r?.outcome ?? null,
      compareMode: q?.compareMode ?? false,
      triggeredBy: p?.triggeredBy ?? null,
      hashtag: p?.hashtag ?? null,
      created_at: j.created_at,
      started_at: j.started_at,
      completed_at: j.completed_at,
      profiles_discovered: j.profiles_discovered,
      dataset_id: r?.dataset_id ?? null,
      apify_run_id: r?.apify_run_id ?? null,
      error_message: typeof j.error_message === "string" ? j.error_message.slice(0, 100) : null,
      created_by: j.created_by,
    }));
  }

  const { data: audits } = await supabase
    .from("discovery_coverage_decisions")
    .select("search_id, timestamp, apify_executed, reason, database_creators_count, search_query")
    .order("timestamp", { ascending: false })
    .limit(10);

  console.log("\n=== 8. RECENT discovery_coverage_decisions ===");
  for (const a of audits ?? []) {
    const sq = a.search_query as Record<string, unknown> | null;
    const bf = sq?.backfill as Record<string, unknown> | null;
    console.log(JSON.stringify({
      search_id: a.search_id,
      timestamp: a.timestamp,
      database_creators_count: a.database_creators_count,
      apify_executed: a.apify_executed,
      reason: a.reason,
      backfill_jobId: bf?.jobId ?? null,
      backfill_acquisitionMode: bf?.acquisitionMode ?? null,
      backfill_queued: bf?.queued ?? null,
      mode: sq?.mode ?? null,
    }));
  }

  console.log("\n=== 9. PROOF CONCLUSION ===");
  console.log(JSON.stringify({
    worker_triggered_because_flag_false: !enabled && backfill.acquisitionMode === "legacy_worker",
    DATASET_ACQUISITION_BACKFILL_proven_unset_or_false: !flagRaw || enabled === false,
    dataset_path_called_this_run: backfill.acquisitionMode === "dataset_import",
    worker_queue_used_this_run: backfill.queued === true,
    direct_search_id: searchIdDirect,
    direct_job_id: backfill.jobId,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
