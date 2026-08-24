/**
 * Enqueue batch profile acquisition jobs (BullMQ + discovery_jobs audit).
 */

import { Queue } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";

import type { BatchProfileAcquisitionJobData } from "./batch-profile-acquisition-types";
import {
  createCreatorEnrichmentQueueConnection,
  getCreatorEnrichmentRedisUrl,
  isCreatorEnrichmentRedisConfigured,
} from "./queue-connection";
import {
  CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
  withTimeout,
} from "./with-timeout";

export const BATCH_PROFILE_ACQUISITION_QUEUE = "batch-profile-acquisition" as const;

export function isBatchProfileAcquisitionQueueAvailable(): boolean {
  return isCreatorEnrichmentRedisConfigured();
}

export async function enqueueBatchProfileAcquisitionJob(
  payload: BatchProfileAcquisitionJobData
): Promise<{ queued: boolean; reason?: string }> {
  const redisUrl = getCreatorEnrichmentRedisUrl();
  if (!redisUrl) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const queue = new Queue(BATCH_PROFILE_ACQUISITION_QUEUE, {
    connection: createCreatorEnrichmentQueueConnection(redisUrl),
  });
  try {
    await withTimeout(
      queue.add("batch-profile-acquisition", payload, {
        ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
        jobId: payload.jobId,
      }),
      CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
      "enqueueBatchProfileAcquisitionJob"
    );
    return { queued: true };
  } catch (error) {
    return {
      queued: false,
      reason: error instanceof Error ? error.message : "Could not enqueue batch profile acquisition.",
    };
  } finally {
    await withTimeout(
      queue.close().catch(() => undefined),
      CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
      "enqueueBatchProfileAcquisitionJob.close"
    ).catch(() => {});
  }
}
