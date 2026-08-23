import { Queue } from "bullmq";

import { CREATOR_ENRICHMENT_QUEUE } from "./constants";
import {
  createCreatorEnrichmentQueueConnection,
  getCreatorEnrichmentRedisUrl,
  isCreatorEnrichmentRedisConfigured,
} from "./queue-connection";
import type { CreatorEnrichmentJobPayload } from "./types";
import {
  CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
  withTimeout,
} from "./with-timeout";

export function isCreatorEnrichmentQueueAvailable(): boolean {
  return isCreatorEnrichmentRedisConfigured();
}

export type CreatorEnrichmentQueueStats = {
  waiting: number;
  active: number;
  delayed: number;
};

let sharedQueue: Queue<CreatorEnrichmentJobPayload> | null = null;
let sharedQueueRedisUrl: string | null = null;

function getSharedQueue(): Queue<CreatorEnrichmentJobPayload> | null {
  const redisUrl = getCreatorEnrichmentRedisUrl();
  if (!redisUrl) return null;
  if (!sharedQueue || sharedQueueRedisUrl !== redisUrl) {
    if (sharedQueue) {
      void sharedQueue.close().catch(() => {});
    }
    sharedQueue = new Queue<CreatorEnrichmentJobPayload>(CREATOR_ENRICHMENT_QUEUE, {
      connection: createCreatorEnrichmentQueueConnection(redisUrl),
    });
    sharedQueueRedisUrl = redisUrl;
  }
  return sharedQueue;
}

const PENDING_OR_ACTIVE_STATES = ["active", "waiting", "prioritized", "delayed"] as const;

export async function getCreatorEnrichmentQueueStats(): Promise<CreatorEnrichmentQueueStats | null> {
  const queue = getSharedQueue();
  if (!queue) return null;
  try {
    const counts = await queue.getJobCounts("waiting", "prioritized", "active", "delayed");
    return {
      waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
    };
  } catch {
    return null;
  }
}

export async function creatorHasInflightEnrichmentJob(
  influencerId: string
): Promise<boolean> {
  const queue = getSharedQueue();
  if (!queue) return false;

  try {
    const knownIds = [
      `creator-enrich-${influencerId}`,
      `creator-enrich-force-${influencerId}`,
    ];
    for (const jobId of knownIds) {
      const job = await withTimeout(
        queue.getJob(jobId),
        CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
        `getJob(${jobId})`
      );
      if (!job) continue;
      const state = await withTimeout(
        job.getState(),
        CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
        `getState(${jobId})`
      );
      if (PENDING_OR_ACTIVE_STATES.includes(state as (typeof PENDING_OR_ACTIVE_STATES)[number])) {
        return true;
      }
    }

    const jobs = await withTimeout(
      queue.getJobs([...PENDING_OR_ACTIVE_STATES], 0, 499),
      CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
      "getJobs(inflight)"
    );
    return jobs.some((job) => job.data.influencerId === influencerId);
  } catch {
    return false;
  }
}

export type CancelCreatorEnrichmentJobsResult = {
  removed: number;
};

export async function cancelCreatorEnrichmentJobs(
  influencerId: string
): Promise<CancelCreatorEnrichmentJobsResult> {
  const queue = getSharedQueue();
  if (!queue) return { removed: 0 };

  let removed = 0;

  try {
    const dedupeJob = await queue.getJob(`creator-enrich-${influencerId}`);
    if (dedupeJob) {
      try {
        if (await dedupeJob.isActive()) {
          await dedupeJob.discard();
        }
        await dedupeJob.remove();
        removed += 1;
      } catch {
        // Best-effort per job.
      }
    }

    const jobs = await queue.getJobs([...PENDING_OR_ACTIVE_STATES], 0, 499);
    for (const job of jobs) {
      if (job.data.influencerId !== influencerId) continue;
      if (job.id === `creator-enrich-${influencerId}`) continue;
      try {
        if (await job.isActive()) {
          await job.discard();
        }
        await job.remove();
        removed += 1;
      } catch {
        // Best-effort per job.
      }
    }
  } catch {
    return { removed };
  }

  return { removed };
}
