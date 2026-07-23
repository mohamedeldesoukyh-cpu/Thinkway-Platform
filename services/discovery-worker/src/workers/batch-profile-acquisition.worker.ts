import { Worker, type Job } from "bullmq";

import { canEnqueueCreatorEnrichment } from "@/lib/creator-enrichment/enabled.js";
import { runBatchProfileAcquisition } from "@/lib/creator-enrichment/batch-profile-acquisition-orchestrator.js";
import type { BatchProfileAcquisitionJobData } from "@/lib/creator-enrichment/batch-profile-acquisition-types.js";

import { supabase } from "../db/supabase.js";
import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";

export function startBatchProfileAcquisitionWorker(): Worker<BatchProfileAcquisitionJobData> {
  return new Worker<BatchProfileAcquisitionJobData>(
    QUEUES.batchProfileAcquisition,
    async (job: Job<BatchProfileAcquisitionJobData>) => {
      const trigger = job.data.trigger ?? "manual";
      const gate = canEnqueueCreatorEnrichment(
        { trigger, scope: job.data.scope ?? "all" },
        { isBulk: true }
      );
      if (!gate.allowed) {
        console.log(
          `[batch-profile-acquisition] skipped ${job.id} — ${gate.reason}`,
          JSON.stringify({ trigger, jobId: job.data.jobId })
        );
        return {
          ok: false,
          job_id: job.data.jobId,
          creators_imported: 0,
          creators_merged: 0,
          creators_failed: 0,
          apify_run_ids: [],
          estimated_credits: 0,
          reason: gate.reason,
          skipped: true,
        };
      }

      const result = await runBatchProfileAcquisition(supabase, job.data);
      return {
        ok: result.ok,
        job_id: result.jobId,
        creators_imported: result.creatorsImported,
        creators_merged: result.creatorsMerged,
        creators_failed: result.creatorsFailed,
        apify_run_ids: result.apifyRunIds,
        estimated_credits: result.estimatedCredits,
        reason: result.reason,
      };
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );
}
