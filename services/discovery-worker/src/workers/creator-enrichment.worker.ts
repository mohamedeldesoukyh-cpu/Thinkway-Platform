import { Queue, Worker, type Job } from "bullmq";

import { executeCreatorMetricsRefresh } from "@/lib/services/creators/creator-enrichment-service.js";
import { writeEnrichmentRun } from "@/lib/creator-enrichment/audit.js";
import {
  CREATOR_ENRICHMENT_DLQ,
  CREATOR_ENRICHMENT_JOB_ATTEMPTS,
} from "@/lib/creator-enrichment/constants.js";
import {
  canEnqueueCreatorEnrichment,
  creatorEnrichmentDisabledMessage,
  isCreatorEnrichmentWorkerEnabled,
} from "@/lib/creator-enrichment/enabled.js";
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
      if (!isCreatorEnrichmentWorkerEnabled()) {
        const message = creatorEnrichmentDisabledMessage();
        console.log(
          `[creator-enrichment] skipped ${job.id} — enrichment globally disabled`,
          JSON.stringify({ influencerId: job.data.influencerId })
        );
        return {
          ok: true,
          status: "skipped",
          message,
          fieldsUpdated: [],
          skippedReason: message,
        };
      }

      const trigger = job.data.trigger ?? "manual";
      const gate = canEnqueueCreatorEnrichment({
        trigger,
        scope: job.data.scope ?? "all",
      });
      if (!gate.allowed) {
        console.log(
          `[creator-enrichment] skipped ${job.id} — ${gate.reason}`,
          JSON.stringify({ influencerId: job.data.influencerId, trigger })
        );
        return {
          ok: true,
          status: "skipped",
          message: gate.reason ?? "Enrichment enqueue gate denied.",
          fieldsUpdated: [],
          skippedReason: gate.reason,
        };
      }

      console.log(
        `[creator-enrichment] processing ${job.id}`,
        JSON.stringify({
          influencerId: job.data.influencerId,
          bypassMetricsManualOverride: Boolean(job.data.bypassMetricsManualOverride),
          force: Boolean(job.data.force),
          trigger,
        })
      );
      const result = await executeCreatorMetricsRefresh(supabase, job.data, {
        attempt: job.attemptsMade + 1,
        jobId: job.id ?? null,
      });
      return result;
    },
    {
      connection: getRedisConnection(),
      // Concurrency 1 — parallel jobs were launching duplicate Instagram Apify runs.
      concurrency: 1,
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

    await supabase
      .from("influencers")
      .update({ enrichment_status: "failed" } as never)
      .eq("id", job.data.influencerId);

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
