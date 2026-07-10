/**
 * Enqueue helper for the `creator-enrichment` queue.
 *
 * ALWAYS best-effort and non-blocking: every trigger (shortlist add, campaign
 * move, detail open, manual refresh) calls this in a way that can NEVER fail the
 * primary action. If Redis is not configured we no-op silently.
 */

import { Queue } from "bullmq";

import {
  CREATOR_ENRICHMENT_BACKOFF_DELAY_MS,
  CREATOR_ENRICHMENT_JOB_ATTEMPTS,
  CREATOR_ENRICHMENT_QUEUE,
  CREATOR_ENRICHMENT_REMOVE_ON_COMPLETE,
  CREATOR_ENRICHMENT_REMOVE_ON_FAIL,
} from "./constants";
import { canEnqueueCreatorEnrichment } from "./enabled";
import { bullmqPriority } from "./policy";
import type { CreatorEnrichmentJobPayload, EnqueueResult } from "./types";

function getConnection(): { url: string } | null {
  const url = process.env.REDIS_URL;
  return url ? { url } : null;
}

export function isCreatorEnrichmentQueueAvailable(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/**
 * De-dupe key. Non-forced jobs collapse onto one id per creator so a burst of
 * triggers (e.g. detail open + shortlist add) does not spend extra Apify credit.
 * Forced refreshes are timestamp-unique so the user always gets a fresh run.
 */
function jobIdFor(payload: CreatorEnrichmentJobPayload): string {
  const platformSuffix = payload.platformAccountId
    ? `-${payload.platformAccountId}`
    : "";
  if (payload.force) {
    // Platform-only refreshes (e.g. add Facebook link) dedupe — one Apify run per account.
    if (payload.platformAccountId) {
      return `creator-enrich-force-${payload.influencerId}${platformSuffix}`;
    }
    return `creator-enrich-force-${payload.influencerId}-${Date.now()}`;
  }
  return `creator-enrich-${payload.influencerId}${platformSuffix}`;
}

export async function enqueueCreatorEnrichment(
  payload: CreatorEnrichmentJobPayload,
  options?: { isBulk?: boolean }
): Promise<EnqueueResult> {
  const gate = canEnqueueCreatorEnrichment(
    { trigger: payload.trigger, scope: payload.scope ?? "all" },
    options
  );
  if (!gate.allowed) {
    console.log(
      "[creator-enrichment] enqueue skipped",
      JSON.stringify({
        influencerId: payload.influencerId,
        trigger: payload.trigger,
        scope: payload.scope ?? "all",
        reason: gate.reason,
      })
    );
    return { queued: false, reason: gate.reason };
  }

  const connection = getConnection();
  if (!connection) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  let queue: Queue<CreatorEnrichmentJobPayload> | null = null;
  try {
    queue = new Queue<CreatorEnrichmentJobPayload>(CREATOR_ENRICHMENT_QUEUE, {
      connection,
    });
    const job = await queue.add(payload.trigger, payload, {
      priority: bullmqPriority(payload.priority),
      jobId: jobIdFor(payload),
      attempts: CREATOR_ENRICHMENT_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: CREATOR_ENRICHMENT_BACKOFF_DELAY_MS },
      removeOnComplete: CREATOR_ENRICHMENT_REMOVE_ON_COMPLETE,
      removeOnFail: CREATOR_ENRICHMENT_REMOVE_ON_FAIL,
    });
    return { queued: true, jobId: job.id };
  } catch (error) {
    return {
      queued: false,
      reason: error instanceof Error ? error.message : "Failed to enqueue enrichment job",
    };
  } finally {
    if (queue) {
      await queue.close().catch(() => {});
    }
  }
}

/**
 * Fire-and-forget wrapper for use inside server actions. Swallows every error so
 * an enrichment hiccup can never roll back the primary mutation.
 */
export function enqueueCreatorEnrichmentBestEffort(
  payload: CreatorEnrichmentJobPayload
): void {
  void enqueueCreatorEnrichment(payload).catch((error) => {
    console.error(
      "[creator-enrichment] enqueue failed (non-blocking)",
      error instanceof Error ? error.message : error
    );
  });
}

export type CreatorEnrichmentQueueStats = {
  waiting: number;
  active: number;
  delayed: number;
};

let sharedQueue: Queue<CreatorEnrichmentJobPayload> | null = null;

function getSharedQueue(): Queue<CreatorEnrichmentJobPayload> | null {
  const connection = getConnection();
  if (!connection) return null;
  if (!sharedQueue) {
    sharedQueue = new Queue<CreatorEnrichmentJobPayload>(CREATOR_ENRICHMENT_QUEUE, {
      connection,
    });
  }
  return sharedQueue;
}

/**
 * Every enrichment job is enqueued with a priority (1–4), so pending jobs sit
 * in BullMQ's `prioritized` state — NOT `waiting`. Any state list that omits
 * `prioritized` is blind to the entire backlog.
 */
const PENDING_OR_ACTIVE_STATES = ["active", "waiting", "prioritized", "delayed"] as const;

/** BullMQ depth for health checks and stale recovery. */
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

/** True when a job for this creator is waiting or actively processing. */
export async function creatorHasInflightEnrichmentJob(
  influencerId: string
): Promise<boolean> {
  const queue = getSharedQueue();
  if (!queue) return false;

  try {
    const jobs = await queue.getJobs([...PENDING_OR_ACTIVE_STATES], 0, 499);
    return jobs.some((job) => job.data.influencerId === influencerId);
  } catch {
    return false;
  }
}

export type CancelCreatorEnrichmentJobsResult = {
  removed: number;
};

/**
 * Remove waiting, delayed, and active BullMQ jobs for one creator.
 * Matches de-dupe id `creator-enrich-{id}` and forced `creator-enrich-force-{id}-*`.
 */
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
