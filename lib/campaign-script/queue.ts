import { Queue } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";
import { createBullMqQueueConnection } from "@/lib/redis/bullmq-connection";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { CampaignScriptMasterView, ScriptLanguage } from "./types";
import {
  CAMPAIGN_SCRIPT_TRANSLATE_JOB_NAME,
  CAMPAIGN_SCRIPT_TRANSLATE_QUEUE,
  campaignScriptTranslateJobId,
  type CampaignScriptTranslateJobData,
} from "./translation-job";
import { decideExplicitTranslation, scriptRegenerateConfirmMessage } from "./translation-policy";
import { updateCampaignScriptAssignmentTranslationState, updateCampaignScriptTranslationState } from "./translation-state";

type Supabase = SupabaseClient<Database>;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
};

let queue: Queue<CampaignScriptTranslateJobData> | null = null;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

function getQueue(): Queue<CampaignScriptTranslateJobData> | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;
  if (!queue) {
    queue = new Queue(CAMPAIGN_SCRIPT_TRANSLATE_QUEUE, {
      connection: createBullMqQueueConnection(redisUrl),
    });
  }
  return queue;
}

function isDuplicateJobError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists|duplicat/i.test(message);
}

export async function enqueueCampaignScriptTranslateJob(
  data: CampaignScriptTranslateJobData
): Promise<{ enqueued: boolean; duplicate?: boolean; jobId?: string; message?: string }> {
  const q = getQueue();
  if (!q) {
    return {
      enqueued: false,
      message: "Translation could not be queued. Retry when background workers are available.",
    };
  }

  const jobId = campaignScriptTranslateJobId(
    data.scriptId,
    data.sourceRevisionId,
    data.targetLanguage,
    data.assignmentId
  );
  const existing = await q.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "active" || state === "waiting" || state === "delayed") {
      return { enqueued: true, duplicate: true, jobId };
    }
    if (state === "completed" || state === "failed") {
      await existing.remove();
    }
  }

  try {
    const job = await q.add(CAMPAIGN_SCRIPT_TRANSLATE_JOB_NAME, data, {
      ...JOB_OPTIONS,
      jobId,
    });
    return { enqueued: true, jobId: job.id };
  } catch (error) {
    if (isDuplicateJobError(error)) {
      return { enqueued: true, duplicate: true, jobId };
    }
    return {
      enqueued: false,
      message: error instanceof Error ? error.message : "Translation could not be queued.",
    };
  }
}

export async function queueCampaignScriptTranslation(
  supabase: Supabase,
  script: CampaignScriptMasterView,
  input: { targetLanguage: ScriptLanguage; confirmed?: boolean }
): Promise<
  | { ok: true; queued: boolean }
  | { ok: false; message: string; needsConfirmation?: boolean }
> {
  const decision = decideExplicitTranslation({
    bodyEn: script.bodyEn,
    bodyAr: script.bodyAr,
    enOrigin: script.enOrigin,
    arOrigin: script.arOrigin,
    targetLanguage: input.targetLanguage,
  });
  if (!decision.ok) return { ok: false, message: decision.message };
  if (decision.requiresConfirmation && !input.confirmed) {
    return {
      ok: false,
      needsConfirmation: true,
      message: scriptRegenerateConfirmMessage(input.targetLanguage),
    };
  }

  await updateCampaignScriptTranslationState(supabase, script.scriptId, {
    translationStatus: "pending",
    translationTargetLanguage: decision.targetLanguage,
    translationSourceRevisionId: script.currentRevisionId,
    translationError: null,
    translationAttempts: 0,
  });

  const enqueued = await enqueueCampaignScriptTranslateJob({
    campaignHeaderId: script.campaignHeaderId,
    scriptId: script.scriptId,
    sourceRevisionId: script.currentRevisionId,
    targetLanguage: decision.targetLanguage,
    forceRegenerate: decision.requiresConfirmation,
  });

  if (!enqueued.enqueued) {
    await updateCampaignScriptTranslationState(supabase, script.scriptId, {
      translationStatus: "failed",
      translationTargetLanguage: decision.targetLanguage,
      translationSourceRevisionId: script.currentRevisionId,
      translationError: enqueued.message ?? "Translation could not be queued.",
    });
    return { ok: false, message: enqueued.message ?? "Translation could not be queued." };
  }

  return { ok: true, queued: true };
}

export async function queueCampaignScriptAssignmentTranslation(
  supabase: Supabase,
  assignmentId: string,
  script: CampaignScriptMasterView,
  input: { targetLanguage: ScriptLanguage; confirmed?: boolean }
): Promise<
  | { ok: true; queued: boolean }
  | { ok: false; message: string; needsConfirmation?: boolean }
> {
  const decision = decideExplicitTranslation({
    bodyEn: script.bodyEn,
    bodyAr: script.bodyAr,
    enOrigin: script.enOrigin,
    arOrigin: script.arOrigin,
    targetLanguage: input.targetLanguage,
  });
  if (!decision.ok) return { ok: false, message: decision.message };
  if (decision.requiresConfirmation && !input.confirmed) {
    return {
      ok: false,
      needsConfirmation: true,
      message: scriptRegenerateConfirmMessage(input.targetLanguage),
    };
  }

  await updateCampaignScriptAssignmentTranslationState(supabase, assignmentId, {
    translationStatus: "pending",
    translationTargetLanguage: decision.targetLanguage,
    translationSourceRevisionId: script.currentRevisionId,
    translationError: null,
    translationAttempts: 0,
  });

  const enqueued = await enqueueCampaignScriptTranslateJob({
    campaignHeaderId: script.campaignHeaderId,
    scriptId: script.scriptId,
    sourceRevisionId: script.currentRevisionId,
    targetLanguage: decision.targetLanguage,
    forceRegenerate: decision.requiresConfirmation,
    assignmentId,
  });

  if (!enqueued.enqueued) {
    await updateCampaignScriptAssignmentTranslationState(supabase, assignmentId, {
      translationStatus: "failed",
      translationTargetLanguage: decision.targetLanguage,
      translationSourceRevisionId: script.currentRevisionId,
      translationError: enqueued.message ?? "Translation could not be queued.",
    });
    return { ok: false, message: enqueued.message ?? "Translation could not be queued." };
  }

  return { ok: true, queued: true };
}
