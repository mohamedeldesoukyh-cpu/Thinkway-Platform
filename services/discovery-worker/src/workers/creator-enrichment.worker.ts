import { Queue, Worker, type Job } from "bullmq";

import { executeCreatorMetricsRefresh } from "@/lib/services/creators/creator-enrichment-service.js";
import { writeEnrichmentRun } from "@/lib/creator-enrichment/audit.js";
import {
  CREATOR_ENRICHMENT_DLQ,
  CREATOR_ENRICHMENT_JOB_ATTEMPTS,
} from "@/lib/creator-enrichment/constants.js";
import type { CreatorEnrichmentJobPayload } from "@/lib/creator-enrichment/types.js";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";
import { config } from "../config.js";

/**
 * Phase 3 — `creator-enrichment` worker.
 *
 * Priorities (set by producers): 1=campaign, 2=shortlist, 3=detail, 4=manual.
 * Retry: handled via the producer's job options (3 attempts, exponential).
 * Dead-letter: jobs that exhaust all attempts are mirrored onto
 * `creator-enrichment-dlq` and recorded as `dead_letter` in
 * `creator_enrichment_runs` for operator visibility.
 */

let dlqQueue: Queue<CreatorEnrichmentJobPayload> | null = null;

function getDlqQueue(): Queue<CreatorEnrichmentJobPayload> {
  if (!dlqQueue) {
    dlqQueue = new Queue<CreatorEnrichmentJobPayload>(CREATOR_ENRICHMENT_DLQ, {
      connection: { url: config.redisUrl },
    });
  }
  return dlqQueue;
}

export function startCreatorEnrichmentWorker(): Worker<CreatorEnrichmentJobPayload> {
  const worker = new Worker<CreatorEnrichmentJobPayload>(
    QUEUES.creatorEnrichment,
    async (job: Job<CreatorEnrichmentJobPayload>) => {
      const result = await executeCreatorMetricsRefresh(supabase, job.data, {
        attempt: job.attemptsMade + 1,
        jobId: job.id ?? null,
      });
      return result;
    },
    {
      connection: getRedisConnection(),
      // Concurrency kept low to preserve Apify credit + avoid rate limits.
      concurrency: 2,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? CREATOR_ENRICHMENT_JOB_ATTEMPTS);
    console.error(
      `[creator-enrichment] failed ${job.id} attempt=${job.attemptsMade}/${job.opts.attempts ?? CREATOR_ENRICHMENT_JOB_ATTEMPTS}`,
      err.message
    );
    if (!exhausted) return;

    // Dead-letter: out of retries.
    try {
      await getDlqQueue().add("dead-letter", job.data, {
        removeOnComplete: false,
        removeOnFail: false,
      });
    } catch (dlqError) {
      console.error("[creator-enrichment] DLQ enqueue failed", dlqError);
    }

    await writeEnrichmentRun(supabase, {
      influencerId: job.data.influencerId,
      discoveredProfileId: job.data.discoveredProfileId,
      trigger: job.data.trigger,
      priority: job.data.priority,
      status: "dead_letter",
      forced: Boolean(job.data.force),
      attempt: job.attemptsMade,
      errorMessage: err.message,
      jobId: job.id ?? null,
      requestedBy: job.data.requestedBy,
      completedAt: new Date().toISOString(),
    });
  });

  worker.on("completed", (job) => {
    console.log(`[creator-enrichment] completed ${job.id}`, job.returnvalue);
  });

  return worker;
}
