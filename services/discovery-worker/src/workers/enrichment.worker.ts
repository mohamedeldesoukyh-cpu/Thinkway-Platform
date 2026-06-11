import { Worker, type Job } from "bullmq";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";
import { runEnrichmentPipeline } from "../enrichment/pipeline.js";
import type { JobLogEntry } from "../discovery/job-observability.js";

export type EnrichmentJobData = {
  jobId?: string;
  profileId: string;
};

async function updateEnrichmentJob(
  jobId: string | undefined,
  patch: Record<string, unknown>
): Promise<void> {
  if (!jobId) return;
  const { error } = await supabase.from("discovery_jobs").update(patch).eq("id", jobId);
  if (error) throw new Error(error.message);
}

export function startEnrichmentWorker(): Worker<EnrichmentJobData> {
  return new Worker<EnrichmentJobData>(
    QUEUES.enrichment,
    async (job: Job<EnrichmentJobData>) => {
      const { jobId, profileId } = job.data;
      const logs: JobLogEntry[] = [];

      const log = (level: JobLogEntry["level"], message: string) => {
        logs.push({ at: new Date().toISOString(), level, message });
      };

      await updateEnrichmentJob(jobId, {
        status: "running",
        started_at: new Date().toISOString(),
        result: { logs, profile_id: profileId },
      });
      log("info", `Enrichment started for profile ${profileId}`);

      try {
        await runEnrichmentPipeline(profileId);
        log("info", "Enrichment pipeline completed");

        await updateEnrichmentJob(jobId, {
          status: "completed",
          completed_at: new Date().toISOString(),
          profiles_enriched: 1,
          result: {
            profile_id: profileId,
            profiles_enriched: 1,
            outcome: "crawl_success",
            logs,
          },
        });

        return { profileId, ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Enrichment failed";
        log("error", message);

        await updateEnrichmentJob(jobId, {
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: message,
          result: {
            profile_id: profileId,
            outcome: "crawl_blocked",
            crawl_error: message,
            logs,
          },
        });
        throw error;
      }
    },
    { connection: getRedisConnection(), concurrency: 3 }
  );
}
