/**
 * INTERNAL.
 * Do not call directly.
 * Use CreatorEnrichmentOrchestrator (via {@link enqueueCreatorEnrichment}) instead.
 *
 * Internal queue implementation — invoked by the orchestrator adapter only.
 * Public callers must use {@link enqueueCreatorEnrichment} from `queue.ts`.
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
import type { CreatorEnrichmentEnqueueOptions } from "@/lib/creator-enrichment/enrichment-feature";
import type { CreatorEnrichmentJobPayload, EnqueueResult } from "./types";

function getConnection(): { url: string } | null {
  const url = process.env.REDIS_URL;
  return url ? { url } : null;
}

/**
 * Stable job IDs — never include Date.now().
 * Repeated force refreshes for the same creator reuse one slot so Apify is not
 * launched in parallel for the same influencer.
 */
export function creatorEnrichmentJobId(payload: CreatorEnrichmentJobPayload): string {
  const platformSuffix = payload.platformAccountId
    ? `-${payload.platformAccountId}`
    : "";
  if (payload.force) {
    return `creator-enrich-force-${payload.influencerId}${platformSuffix}`;
  }
  return `creator-enrich-${payload.influencerId}${platformSuffix}`;
}

const INFLIGHT_STATES = new Set(["active", "waiting", "delayed", "prioritized", "waiting-children"]);

export async function enqueueCreatorEnrichmentImpl(
  payload: CreatorEnrichmentJobPayload,
  options?: CreatorEnrichmentEnqueueOptions
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

    const jobId = creatorEnrichmentJobId(payload);
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (INFLIGHT_STATES.has(state)) {
        return { queued: true, jobId: existing.id };
      }
      // Completed / failed / unknown — free the slot so a new refresh can run.
      try {
        await existing.remove();
      } catch {
        // Race with another worker finishing remove — continue to add.
      }
    }

    const job = await queue.add(payload.trigger, payload, {
      priority: bullmqPriority(payload.priority),
      jobId,
      attempts: CREATOR_ENRICHMENT_JOB_ATTEMPTS,
      backoff: { type: "exponential", delay: CREATOR_ENRICHMENT_BACKOFF_DELAY_MS },
      removeOnComplete: CREATOR_ENRICHMENT_REMOVE_ON_COMPLETE,
      removeOnFail: CREATOR_ENRICHMENT_REMOVE_ON_FAIL,
    });
    return { queued: true, jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue enrichment job";
    // BullMQ duplicate jobId race — treat as already queued.
    if (/already exists|JobId/i.test(message)) {
      return { queued: true, jobId: creatorEnrichmentJobId(payload) };
    }
    return { queued: false, reason: message };
  } finally {
    if (queue) {
      await queue.close().catch(() => {});
    }
  }
}
