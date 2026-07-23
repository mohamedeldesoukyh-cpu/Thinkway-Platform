/**
 * Sprint 3 — Dataset Acquisition Orchestrator.
 * Search → dataset → bulk importApifyStoredPayloadWithDnaPipeline (no per-creator Apify fetches).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { importApifyStoredPayloadWithDnaPipeline } from "@/lib/discovery/apify-import-pipeline";
import { groupApifyRowsIntoCreators } from "@/lib/discovery/apify-dataset-grouping";
import { refreshDiscoverySearchAfterImport } from "@/lib/discovery/discovery-search-refresh";
import { runApifyDiscoveryDatasetSearch } from "@/lib/discovery/apify-dataset-search";
import type { IntelligenceSufficiencyEvaluation } from "@/lib/discovery/intelligence-sufficiency";
import type { DiscoveryJobPayload, DiscoveryPlatform } from "@/lib/discovery/types";
import { resolveDatasetAcquisitionMaxCreators } from "@/lib/discovery/dataset-acquisition-config";
import {
  checkAcquisitionJobCancelled,
  finalizeCancelledDiscoveryJob,
} from "@/lib/discovery/acquisition-session";
import {
  logDatasetImportFailure,
  type DatasetImportFailureLog,
} from "@/lib/discovery/dataset-import-logging";
import { fetchApifyDatasetItems } from "@/lib/discovery/apify-dataset-search";
import { assertApifyAcquisitionBudget } from "@/lib/discovery/control-center/apify-budget";
import { normalizeSocialPlatform } from "@/lib/social/normalize-platform";

export type DatasetAcquisitionInput = {
  searchId: string;
  platform: DiscoveryPlatform;
  jobPayload: DiscoveryJobPayload;
  countryCode?: string | null;
  categoryTags?: string[];
  maxCreators?: number;
  timeoutMs?: number;
  uploadAvatars?: boolean;
  intelligence?: IntelligenceSufficiencyEvaluation;
  discoveryJobId?: string;
  searchSessionId?: string | null;
};

export type DatasetAcquisitionResult = {
  ok: boolean;
  cancelled?: boolean;
  apifyRunId: string | null;
  datasetId: string | null;
  creatorsProcessed: number;
  creatorsImported: number;
  creatorsMerged: number;
  creatorsFailed: number;
  creatorsSkipped: number;
  enrichmentJobsQueued: number;
  intelligenceGaps: IntelligenceSufficiencyEvaluation["intelligenceGaps"];
  reason: string;
  importFailures?: DatasetImportFailureLog[];
};

function defaultTimeoutMs(): number {
  const raw = process.env.DATASET_ACQUISITION_TIMEOUT_MS?.trim();
  const parsed = raw ? Number(raw) : 45_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 45_000;
}

async function updateDiscoveryJob(
  supabase: SupabaseClient,
  jobId: string | undefined,
  patch: Record<string, unknown>
): Promise<void> {
  if (!jobId) return;
  await supabase.from("discovery_jobs").update(patch).eq("id", jobId);
}

async function abortIfAcquisitionCancelled(
  supabase: SupabaseClient,
  input: Pick<DatasetAcquisitionInput, "discoveryJobId" | "searchSessionId">
): Promise<DatasetAcquisitionResult | null> {
  const check = await checkAcquisitionJobCancelled(
    supabase,
    input.discoveryJobId,
    input.searchSessionId
  );
  if (!check.cancelled) return null;

  const reason = check.reason ?? "Search session ended.";
  await finalizeCancelledDiscoveryJob(supabase, input.discoveryJobId, reason);

  return {
    ok: false,
    cancelled: true,
    apifyRunId: null,
    datasetId: null,
    creatorsProcessed: 0,
    creatorsImported: 0,
    creatorsMerged: 0,
    creatorsFailed: 0,
    creatorsSkipped: 0,
    enrichmentJobsQueued: 0,
    intelligenceGaps: [],
    reason,
  };
}

export async function runDatasetAcquisitionBackfill(
  supabase: SupabaseClient,
  input: DatasetAcquisitionInput
): Promise<DatasetAcquisitionResult> {
  const maxCreators = input.maxCreators ?? resolveDatasetAcquisitionMaxCreators(input.intelligence);
  const timeoutMs = input.timeoutMs ?? defaultTimeoutMs();
  const platform = input.platform;
  const intelligenceGaps = input.intelligence?.intelligenceGaps ?? [];

  const preAbort = await abortIfAcquisitionCancelled(supabase, input);
  if (preAbort) {
    preAbort.intelligenceGaps = intelligenceGaps;
    return preAbort;
  }

  if (!normalizeSocialPlatform(platform)) {
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      creatorsProcessed: 0,
      creatorsImported: 0,
      creatorsMerged: 0,
      creatorsFailed: 0,
      creatorsSkipped: 0,
      enrichmentJobsQueued: 0,
      intelligenceGaps,
      reason: `Unsupported platform for dataset acquisition: ${platform}`,
    };
  }

  const budget = await assertApifyAcquisitionBudget(supabase, {
    source: "dataset_acquisition",
    meta: {
      searchId: input.searchId,
      platform,
      discoveryJobId: input.discoveryJobId ?? null,
    },
  });
  if (!budget.allowed) {
    return {
      ok: false,
      apifyRunId: null,
      datasetId: null,
      creatorsProcessed: 0,
      creatorsImported: 0,
      creatorsMerged: 0,
      creatorsFailed: 0,
      creatorsSkipped: 0,
      enrichmentJobsQueued: 0,
      intelligenceGaps,
      reason: budget.reason,
    };
  }

  const search = await runApifyDiscoveryDatasetSearch({
    platform,
    jobPayload: input.jobPayload,
    limit: maxCreators,
    timeoutMs,
    acquisitionHints: input.intelligence?.acquisitionHints,
  });

  const postApifyAbort = await abortIfAcquisitionCancelled(supabase, input);
  if (postApifyAbort) {
    postApifyAbort.intelligenceGaps = intelligenceGaps;
    postApifyAbort.apifyRunId = search.apifyRunId;
    postApifyAbort.datasetId = search.datasetId;
    return postApifyAbort;
  }

  if (!search.ok) {
    await updateDiscoveryJob(supabase, input.discoveryJobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: search.reason,
      result: {
        acquisition_mode: "dataset_import",
        intelligence_gaps: intelligenceGaps,
        apify_run_id: search.apifyRunId,
        dataset_id: search.datasetId,
      },
    });

    return {
      ok: false,
      apifyRunId: search.apifyRunId,
      datasetId: search.datasetId,
      creatorsProcessed: 0,
      creatorsImported: 0,
      creatorsMerged: 0,
      creatorsFailed: 0,
      creatorsSkipped: 0,
      enrichmentJobsQueued: 0,
      intelligenceGaps,
      reason: search.reason,
    };
  }

  const bundles = groupApifyRowsIntoCreators(search.rows, platform).slice(0, maxCreators);

  let creatorsImported = 0;
  let creatorsMerged = 0;
  let creatorsFailed = 0;
  let creatorsSkipped = 0;
  let enrichmentJobsQueued = 0;
  const importFailures: DatasetImportFailureLog[] = [];
  const importedInfluencerIds: string[] = [];

  for (const bundle of bundles) {
    const loopAbort = await abortIfAcquisitionCancelled(supabase, input);
    if (loopAbort) {
      loopAbort.intelligenceGaps = intelligenceGaps;
      loopAbort.apifyRunId = search.apifyRunId;
      loopAbort.datasetId = search.datasetId;
      loopAbort.creatorsProcessed = creatorsImported + creatorsMerged + creatorsFailed + creatorsSkipped;
      loopAbort.creatorsImported = creatorsImported;
      loopAbort.creatorsMerged = creatorsMerged;
      loopAbort.creatorsFailed = creatorsFailed;
      loopAbort.creatorsSkipped = creatorsSkipped;
      loopAbort.enrichmentJobsQueued = enrichmentJobsQueued;
      loopAbort.cancelled = true;
      await updateDiscoveryJob(supabase, input.discoveryJobId, {
        status: "cancelled",
        completed_at: new Date().toISOString(),
        error_message: loopAbort.reason,
        profiles_discovered: creatorsImported + creatorsMerged,
        result: {
          acquisition_mode: "dataset_import",
          intelligence_gaps: intelligenceGaps,
          apify_run_id: search.apifyRunId,
          dataset_id: search.datasetId,
          creators_imported: creatorsImported,
          creators_merged: creatorsMerged,
          creators_failed: creatorsFailed,
          creators_skipped: creatorsSkipped,
          enrichment_jobs_queued: enrichmentJobsQueued,
          imported_influencer_ids: importedInfluencerIds,
          import_failures: importFailures,
          cancelled_mid_import: true,
        },
      });
      return loopAbort;
    }

    if (bundle.profileRows.length === 0 && bundle.postRows.length === 0) {
      creatorsSkipped += 1;
      continue;
    }

    try {
      const result = await importApifyStoredPayloadWithDnaPipeline(supabase, {
        platform,
        username: bundle.username,
        profileUrl: bundle.profileUrl,
        profileRows: bundle.profileRows,
        postRows: bundle.postRows,
        apifyRunId: search.apifyRunId,
        countryCode: input.countryCode,
        categoryTags: input.categoryTags,
        searchId: input.searchId,
        uploadAvatar: input.uploadAvatars ?? true,
        // Dataset already paid for Apify — never N+1 profile scrapes per creator.
        allowLiveApifyBackfill: false,
      });

      if (!result.ok) {
        creatorsFailed += 1;
        const failure: DatasetImportFailureLog = {
          stage: "import_pipeline",
          username: bundle.username,
          datasetId: search.datasetId,
          searchId: input.searchId,
          apifyRunId: search.apifyRunId,
          message: result.message,
        };
        importFailures.push(failure);
        logDatasetImportFailure(failure);
        continue;
      }

      if (result.merged) creatorsMerged += 1;
      else creatorsImported += 1;

      if (result.influencerId) {
        importedInfluencerIds.push(result.influencerId);
      }
    } catch (error) {
      creatorsFailed += 1;
      const failure: DatasetImportFailureLog = {
        stage: "import_pipeline_exception",
        username: bundle.username,
        datasetId: search.datasetId,
        searchId: input.searchId,
        apifyRunId: search.apifyRunId,
        message: error instanceof Error ? error.message : String(error),
      };
      importFailures.push(failure);
      logDatasetImportFailure(failure);
    }
  }

  const creatorsProcessed = bundles.length;
  const profilesAdded = creatorsImported + creatorsMerged;
  const ok = profilesAdded > 0;

  if (ok) {
    await refreshDiscoverySearchAfterImport(supabase);
  }

  const reason = ok
    ? `Dataset acquisition imported ${profilesAdded} creator(s) from Apify dataset (${search.rows.length} rows, ${creatorsProcessed} bundles).`
    : `Apify dataset had ${search.rows.length} row(s) but import added 0 creators.`;

  await updateDiscoveryJob(supabase, input.discoveryJobId, {
    status: ok ? "completed" : "failed",
    completed_at: new Date().toISOString(),
    profiles_discovered: profilesAdded,
    error_message: ok ? null : reason,
    result: {
      acquisition_mode: "dataset_import",
      intelligence_gaps: intelligenceGaps,
      apify_run_id: search.apifyRunId,
      dataset_id: search.datasetId,
      rows_received: search.rows.length,
      creators_processed: creatorsProcessed,
      creators_imported: creatorsImported,
      creators_merged: creatorsMerged,
      creators_failed: creatorsFailed,
      creators_skipped: creatorsSkipped,
      enrichment_jobs_queued: enrichmentJobsQueued,
      profiles_added: profilesAdded,
      imported_influencer_ids: importedInfluencerIds,
      import_failures: importFailures,
    },
  });

  return {
    ok,
    apifyRunId: search.apifyRunId,
    datasetId: search.datasetId,
    creatorsProcessed,
    creatorsImported,
    creatorsMerged,
    creatorsFailed,
    creatorsSkipped,
    enrichmentJobsQueued,
    intelligenceGaps,
    reason,
    importFailures,
  };
}

export type StoredDatasetImportInput = {
  searchId: string;
  platform: DiscoveryPlatform;
  datasetId: string;
  apifyRunId?: string | null;
  countryCode?: string | null;
  categoryTags?: string[];
  maxCreators?: number;
  uploadAvatars?: boolean;
  intelligence?: IntelligenceSufficiencyEvaluation;
};

/**
 * Import creators from an existing Apify dataset (no new actor run).
 */
export async function runStoredApifyDatasetImport(
  supabase: SupabaseClient,
  input: StoredDatasetImportInput
): Promise<DatasetAcquisitionResult> {
  const platform = input.platform;
  const intelligenceGaps = input.intelligence?.intelligenceGaps ?? [];
  const maxCreators = input.maxCreators ?? resolveDatasetAcquisitionMaxCreators(input.intelligence);

  if (!normalizeSocialPlatform(platform)) {
    return {
      ok: false,
      apifyRunId: input.apifyRunId ?? null,
      datasetId: input.datasetId,
      creatorsProcessed: 0,
      creatorsImported: 0,
      creatorsMerged: 0,
      creatorsFailed: 0,
      creatorsSkipped: 0,
      enrichmentJobsQueued: 0,
      intelligenceGaps,
      reason: `Unsupported platform for dataset import: ${platform}`,
    };
  }

  const token = process.env.APIFY_TOKEN?.trim();
  if (!token) {
    return {
      ok: false,
      apifyRunId: input.apifyRunId ?? null,
      datasetId: input.datasetId,
      creatorsProcessed: 0,
      creatorsImported: 0,
      creatorsMerged: 0,
      creatorsFailed: 0,
      creatorsSkipped: 0,
      enrichmentJobsQueued: 0,
      intelligenceGaps,
      reason: "APIFY_TOKEN is not configured.",
    };
  }

  const rows = await fetchApifyDatasetItems(input.datasetId, token, 1000);
  const bundles = groupApifyRowsIntoCreators(rows, platform).slice(0, maxCreators);

  let creatorsImported = 0;
  let creatorsMerged = 0;
  let creatorsFailed = 0;
  let creatorsSkipped = 0;
  let enrichmentJobsQueued = 0;
  const importFailures: DatasetImportFailureLog[] = [];

  for (const bundle of bundles) {
    if (bundle.profileRows.length === 0 && bundle.postRows.length === 0) {
      creatorsSkipped += 1;
      continue;
    }

    try {
      const result = await importApifyStoredPayloadWithDnaPipeline(supabase, {
        platform,
        username: bundle.username,
        profileUrl: bundle.profileUrl,
        profileRows: bundle.profileRows,
        postRows: bundle.postRows,
        apifyRunId: input.apifyRunId ?? null,
        countryCode: input.countryCode,
        categoryTags: input.categoryTags,
        searchId: input.searchId,
        uploadAvatar: input.uploadAvatars ?? true,
        allowLiveApifyBackfill: false,
      });

      if (!result.ok) {
        creatorsFailed += 1;
        const failure: DatasetImportFailureLog = {
          stage: "import_pipeline",
          username: bundle.username,
          datasetId: input.datasetId,
          searchId: input.searchId,
          apifyRunId: input.apifyRunId ?? null,
          message: result.message,
        };
        importFailures.push(failure);
        logDatasetImportFailure(failure);
        continue;
      }

      if (result.merged) creatorsMerged += 1;
      else creatorsImported += 1;
    } catch (error) {
      creatorsFailed += 1;
      const failure: DatasetImportFailureLog = {
        stage: "import_pipeline_exception",
        username: bundle.username,
        datasetId: input.datasetId,
        searchId: input.searchId,
        apifyRunId: input.apifyRunId ?? null,
        message: error instanceof Error ? error.message : String(error),
      };
      importFailures.push(failure);
      logDatasetImportFailure(failure);
    }
  }

  const creatorsProcessed = bundles.length;
  const profilesAdded = creatorsImported + creatorsMerged;
  const ok = profilesAdded > 0;
  const reason = ok
    ? `Stored dataset import added ${profilesAdded} creator(s) (${rows.length} rows, ${creatorsProcessed} bundles).`
    : `Apify dataset had ${rows.length} row(s) but import added 0 creators.`;

  return {
    ok,
    apifyRunId: input.apifyRunId ?? null,
    datasetId: input.datasetId,
    creatorsProcessed,
    creatorsImported,
    creatorsMerged,
    creatorsFailed,
    creatorsSkipped,
    enrichmentJobsQueued,
    intelligenceGaps,
    reason,
    importFailures,
  };
}
