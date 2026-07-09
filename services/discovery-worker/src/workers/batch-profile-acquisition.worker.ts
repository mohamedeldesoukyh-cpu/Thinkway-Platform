import { Worker, type Job } from "bullmq";

import { runBatchProfileAcquisition } from "@/lib/creator-enrichment/batch-profile-acquisition-orchestrator.js";
import type { BatchProfileAcquisitionJobData } from "@/lib/creator-enrichment/batch-profile-acquisition-types.js";

import { supabase } from "../db/supabase.js";
import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";

export function startBatchProfileAcquisitionWorker(): Worker<BatchProfileAcquisitionJobData> {
  return new Worker<BatchProfileAcquisitionJobData>(
    QUEUES.batchProfileAcquisition,
    async (job: Job<BatchProfileAcquisitionJobData>) => {
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
