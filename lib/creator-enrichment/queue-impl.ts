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
import { logManualRefreshTrace } from "./manual-refresh-trace";
import { bullmqPriority } from "./policy";
import type { CreatorEnrichmentEnqueueOptions } from "@/lib/creator-enrichment/enrichment-feature";
import type { CreatorEnrichmentJobPayload, EnqueueResult } from "./types";
import {
  createCreatorEnrichmentQueueConnection,
  getCreatorEnrichmentRedisUrl,
} from "./queue-connection";
import {
  CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
  withTimeout,
} from "./with-timeout";

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

  const redisUrl = getCreatorEnrichmentRedisUrl();
  if (!redisUrl) {
    logManualRefreshTrace("queue_add_result", {
      influencerId: payload.influencerId,
      queued: false,
      reason: "REDIS_URL not configured",
    });
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const jobId = creatorEnrichmentJobId(payload);
  const connection = createCreatorEnrichmentQueueConnection(redisUrl);
  logManualRefreshTrace("queue_add_start", {
    influencerId: payload.influencerId,
    trigger: payload.trigger,
    scope: payload.scope ?? "all",
    force: Boolean(payload.force),
    stableJobId: jobId,
    queueName: CREATOR_ENRICHMENT_QUEUE,
    producerConnectionShape: "createBullMqQueueConnection",
    ioredisIgnoresUrlKey: false,
    connectionHost: (connection as { host?: string }).host ?? null,
    connectionPort: (connection as { port?: number }).port ?? null,
  });

  let queue: Queue<CreatorEnrichmentJobPayload> | null = null;
  const enqueueStartedAt = Date.now();
  try {
    queue = new Queue<CreatorEnrichmentJobPayload>(CREATOR_ENRICHMENT_QUEUE, {
      connection,
    });

    const existing = await withTimeout(
      queue.getJob(jobId),
      CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
      `getJob(${jobId})`
    );
    if (existing) {
      const state = await withTimeout(
        existing.getState(),
        CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
        `getState(${jobId})`
      );
      if (INFLIGHT_STATES.has(state)) {
        logManualRefreshTrace("queue_add_result", {
          influencerId: payload.influencerId,
          queued: true,
          jobId: existing.id,
          reuseExisting: true,
          state,
          durationMs: Date.now() - enqueueStartedAt,
        });
        return { queued: true, jobId: existing.id };
      }
      // Completed / failed / unknown — free the slot so a new refresh can run.
      try {
        await withTimeout(
          existing.remove(),
          CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
          `remove(${jobId})`
        );
      } catch {
        // Race with another worker finishing remove — continue to add.
      }
    }

    const job = await withTimeout(
      queue.add(payload.trigger, payload, {
        priority: bullmqPriority(payload.priority),
        jobId,
        attempts: CREATOR_ENRICHMENT_JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: CREATOR_ENRICHMENT_BACKOFF_DELAY_MS },
        removeOnComplete: CREATOR_ENRICHMENT_REMOVE_ON_COMPLETE,
        removeOnFail: CREATOR_ENRICHMENT_REMOVE_ON_FAIL,
      }),
      CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
      `add(${jobId})`
    );
    logManualRefreshTrace("queue_add_result", {
      influencerId: payload.influencerId,
      queued: true,
      jobId: job.id,
      reuseExisting: false,
      durationMs: Date.now() - enqueueStartedAt,
    });
    return { queued: true, jobId: job.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to enqueue enrichment job";
    // BullMQ duplicate jobId race — treat as already queued.
    if (/already exists|JobId/i.test(message)) {
      logManualRefreshTrace("queue_add_result", {
        influencerId: payload.influencerId,
        queued: true,
        jobId: creatorEnrichmentJobId(payload),
        duplicateRace: true,
        durationMs: Date.now() - enqueueStartedAt,
      });
      return { queued: true, jobId: creatorEnrichmentJobId(payload) };
    }
    logManualRefreshTrace("queue_add_result", {
      influencerId: payload.influencerId,
      queued: false,
      reason: message,
      durationMs: Date.now() - enqueueStartedAt,
    });
    return { queued: false, reason: message };
  } finally {
    if (queue) {
      await withTimeout(
        queue.close(),
        CREATOR_ENRICHMENT_REDIS_COMMAND_TIMEOUT_MS,
        "queue.close"
      ).catch(() => {});
    }
  }
}
