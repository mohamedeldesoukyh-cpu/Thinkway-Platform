/**
 * Public API for starting and monitoring batch profile acquisition jobs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  estimateBatchProfileAcquisitionUsage,
  getBatchProfileAcquisitionConfig,
} from "@/lib/creator-enrichment/batch-profile-acquisition-policy";
import { enqueueBatchProfileAcquisitionJob } from "@/lib/creator-enrichment/batch-profile-acquisition-queue";
import { cancelCreatorEnrichmentJobs } from "@/lib/creator-enrichment/queue-operations";
import type {
  BatchProfileAcquisitionJobData,
  BatchProfileAcquisitionProgress,
} from "@/lib/creator-enrichment/batch-profile-acquisition-types";
import {
  resolveBatchProfileTargets,
} from "@/lib/creator-enrichment/batch-profile-target-resolver";
import {
  canEnqueueCreatorEnrichment,
  creatorEnrichmentDisabledMessage,
  type EnrichmentScope,
} from "@/lib/creator-enrichment/enabled";
import type { EnrichmentTrigger } from "@/lib/creator-enrichment/types";
import { assertApifyAcquisitionBudget } from "@/lib/discovery/control-center/apify-budget";

type AnySupabase = SupabaseClient;

export type StartBatchProfileAcquisitionInput = {
  unifiedIds: string[];
  trigger?: EnrichmentTrigger;
  scope?: EnrichmentScope;
  requestedBy?: string | null;
  platformAccountId?: string | null;
  uploadAvatars?: boolean;
};

export type StartBatchProfileAcquisitionResult = {
  ok: boolean;
  jobId: string | null;
  queued: boolean;
  targetsResolved: number;
  targetsFailed: number;
  estimatedApifyRuns: number;
  estimatedCredits: number;
  batchCount: number;
  message: string;
  resolutionErrors?: Array<{ unifiedId: string; message: string }>;
};

export async function startBatchProfileAcquisition(
  supabase: AnySupabase,
  input: StartBatchProfileAcquisitionInput
): Promise<StartBatchProfileAcquisitionResult> {
  const config = getBatchProfileAcquisitionConfig();
  const trigger = input.trigger ?? "manual";
  const scope = input.scope ?? "metrics";

  const gate = canEnqueueCreatorEnrichment({ trigger, scope }, { isBulk: true });
  if (!gate.allowed) {
    return {
      ok: false,
      jobId: null,
      queued: false,
      targetsResolved: 0,
      targetsFailed: 0,
      estimatedApifyRuns: 0,
      estimatedCredits: 0,
      batchCount: 0,
      message: gate.reason ?? creatorEnrichmentDisabledMessage(),
    };
  }

  const budget = await assertApifyAcquisitionBudget(supabase, {
    source: "batch_profile_acquisition_enqueue",
    meta: { trigger, scope, creatorCount: input.unifiedIds.length },
  });
  if (!budget.allowed) {
    return {
      ok: false,
      jobId: null,
      queued: false,
      targetsResolved: 0,
      targetsFailed: 0,
      estimatedApifyRuns: 0,
      estimatedCredits: 0,
      batchCount: 0,
      message: budget.reason,
    };
  }

  const { targets, failed } = await resolveBatchProfileTargets(supabase, {
    unifiedIds: input.unifiedIds,
    platformAccountId: input.platformAccountId,
    requestedBy: input.requestedBy,
  });

  if (targets.length === 0) {
    return {
      ok: false,
      jobId: null,
      queued: false,
      targetsResolved: 0,
      targetsFailed: failed.length,
      estimatedApifyRuns: 0,
      estimatedCredits: 0,
      batchCount: 0,
      message: "No profile URLs could be resolved for batch acquisition.",
      resolutionErrors: failed,
    };
  }

  const influencerIds = [
    ...new Set(
      targets.map((target) => target.influencerId).filter((id): id is string => Boolean(id))
    ),
  ];
  for (const influencerId of influencerIds) {
    await cancelCreatorEnrichmentJobs(influencerId);
  }

  const platformsSummary = [...new Set(targets.map((target) => target.platform))];
  console.log(
    `[batch-profile-acquisition] resolved ${targets.length} target(s) across platforms: ${platformsSummary.join(", ")}`
  );

  const platformEstimates = new Map<string, number>();
  for (const target of targets) {
    platformEstimates.set(target.platform, (platformEstimates.get(target.platform) ?? 0) + 1);
  }

  let estimatedApifyRuns = 0;
  let estimatedCredits = 0;
  let batchCount = 0;
  for (const [platform, count] of platformEstimates) {
    const usage = estimateBatchProfileAcquisitionUsage({
      profileCount: count,
      platform,
      scope,
      config,
    });
    estimatedApifyRuns += usage.estimatedApifyRuns;
    estimatedCredits += usage.estimatedCredits;
    batchCount += usage.batchCount;
  }

  const { data: job, error: jobError } = await supabase
    .from("discovery_jobs")
    .insert({
      job_type: "enrichment:batch_profile_acquisition",
      method: null,
      status: "pending",
      payload: {
        trigger,
        scope,
        requested_by: input.requestedBy ?? null,
        targets_count: targets.length,
        unified_ids: input.unifiedIds,
        estimated_apify_runs: estimatedApifyRuns,
        estimated_credits: estimatedCredits,
        batch_count: batchCount,
        batch_size: config.batchSize,
      },
      result: {
        acquisition_mode: "batch_profile",
        status: "pending",
        creators_total: targets.length,
        estimated_apify_runs: estimatedApifyRuns,
        estimated_credits: estimatedCredits,
        batches_total: batchCount,
      },
      created_by: input.requestedBy ?? null,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return {
      ok: false,
      jobId: null,
      queued: false,
      targetsResolved: targets.length,
      targetsFailed: failed.length,
      estimatedApifyRuns,
      estimatedCredits,
      batchCount,
      message: jobError?.message ?? "Failed to create batch acquisition job.",
      resolutionErrors: failed,
    };
  }

  const jobId = job.id as string;
  const payload: BatchProfileAcquisitionJobData = {
    jobId,
    targets,
    trigger,
    scope,
    requestedBy: input.requestedBy ?? null,
    uploadAvatars: input.uploadAvatars ?? false,
  };

  const queued = await enqueueBatchProfileAcquisitionJob(payload);
  if (!queued.queued) {
    await supabase
      .from("discovery_jobs")
      .update({
        status: "failed",
        error_message: queued.reason ?? "Queue unavailable",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return {
      ok: false,
      jobId,
      queued: false,
      targetsResolved: targets.length,
      targetsFailed: failed.length,
      estimatedApifyRuns,
      estimatedCredits,
      batchCount,
      message: queued.reason ?? "Could not enqueue batch profile acquisition.",
      resolutionErrors: failed,
    };
  }

  return {
    ok: true,
    jobId,
    queued: true,
    targetsResolved: targets.length,
    targetsFailed: failed.length,
    estimatedApifyRuns,
    estimatedCredits,
    batchCount,
    message: `Batch profile acquisition queued for ${targets.length} creator(s) (~${estimatedApifyRuns} Apify run(s), ~${estimatedCredits} credits).`,
    resolutionErrors: failed.length > 0 ? failed : undefined,
  };
}

export async function getBatchProfileAcquisitionJob(
  supabase: AnySupabase,
  jobId: string
): Promise<{
  id: string;
  status: string;
  progress: BatchProfileAcquisitionProgress | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
} | null> {
  const { data, error } = await supabase
    .from("discovery_jobs")
    .select("id, status, result, error_message, started_at, completed_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    status: data.status as string,
    progress: (data.result as BatchProfileAcquisitionProgress | null) ?? null,
    errorMessage: data.error_message as string | null,
    startedAt: data.started_at as string | null,
    completedAt: data.completed_at as string | null,
  };
}
