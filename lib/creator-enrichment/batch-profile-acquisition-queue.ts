/**
 * Enqueue batch profile acquisition jobs (BullMQ + discovery_jobs audit).
 */

import { Queue } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";

import type { BatchProfileAcquisitionJobData } from "./batch-profile-acquisition-types";

export const BATCH_PROFILE_ACQUISITION_QUEUE = "batch-profile-acquisition" as const;

function getConnection(): { url: string } | null {
  const url = process.env.REDIS_URL?.trim();
  return url ? { url } : null;
}

export function isBatchProfileAcquisitionQueueAvailable(): boolean {
  return Boolean(getConnection());
}

export async function enqueueBatchProfileAcquisitionJob(
  payload: BatchProfileAcquisitionJobData
): Promise<{ queued: boolean; reason?: string }> {
  const connection = getConnection();
  if (!connection) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const queue = new Queue(BATCH_PROFILE_ACQUISITION_QUEUE, { connection });
  try {
    await queue.add("batch-profile-acquisition", payload, {
      ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
      jobId: payload.jobId,
    });
    return { queued: true };
  } finally {
    await queue.close().catch(() => {});
  }
}
