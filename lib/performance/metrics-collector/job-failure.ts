import type { SupabaseClient } from "@supabase/supabase-js";

import { logMetricsQueueEvent } from "@/lib/performance/metrics-collector/metrics-queue-log";
import {
  markPublicationRefreshStatus,
  writeSyncLog,
} from "@/lib/performance/metrics-collector/persist";

const DEFAULT_MAX_ATTEMPTS = 3;

export function isMetricsJobAttemptsExhausted(
  attemptsMade: number,
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): boolean {
  return attemptsMade >= maxAttempts;
}

export async function handlePublicationMetricsJobFailure(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    triggeredBy: string;
    jobId?: string | null;
    attemptsMade: number;
    maxAttempts?: number;
    error: string;
    provider?: string | null;
  }
): Promise<boolean> {
  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  if (!isMetricsJobAttemptsExhausted(input.attemptsMade, maxAttempts)) {
    return false;
  }

  logMetricsQueueEvent("JOB_FAILED", {
    publicationId: input.publicationId,
    jobId: input.jobId,
    provider: input.provider ?? null,
    status: "failed",
    attemptsMade: input.attemptsMade,
    error: input.error,
  });

  await markPublicationRefreshStatus(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
    status: "failed",
  });

  await writeSyncLog(supabase, {
    publicationId: input.publicationId,
    campaignHeaderId: input.campaignHeaderId,
    provider: "manual",
    attemptOrder: 0,
    status: "failed",
    message: `Metrics collection job failed after ${input.attemptsMade} attempt(s).`,
    errorCode: "job_exhausted",
    error: input.error,
    triggeredBy: input.triggeredBy,
    completed: true,
    responseSummary: {
      jobId: input.jobId ?? null,
      attemptsMade: input.attemptsMade,
      maxAttempts,
      provider: input.provider ?? null,
    },
  });

  return true;
}
