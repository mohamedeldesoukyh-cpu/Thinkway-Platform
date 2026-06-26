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
  if (payload.force) {
    return `creator-enrich-force-${payload.influencerId}-${Date.now()}`;
  }
  return `creator-enrich-${payload.influencerId}`;
}

export async function enqueueCreatorEnrichment(
  payload: CreatorEnrichmentJobPayload
): Promise<EnqueueResult> {
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
