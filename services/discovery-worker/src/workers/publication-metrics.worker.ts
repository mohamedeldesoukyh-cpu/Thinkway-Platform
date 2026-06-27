import { Worker, type Job } from "bullmq";

import { handlePublicationMetricsJobFailure } from "@/lib/performance/metrics-collector/job-failure";
import { logMetricsQueueEvent } from "@/lib/performance/metrics-collector/metrics-queue-log";
import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";
import { extractPostMetricsWithPlaywright } from "../metrics/playwright-extract.js";

export type PublicationMetricsJobData = {
  publicationId: string;
  campaignHeaderId: string;
  triggeredBy: string;
};

const JOB_ATTEMPTS = 3;

export function startPublicationMetricsWorker(): Worker<PublicationMetricsJobData> {
  const worker = new Worker<PublicationMetricsJobData>(
    QUEUES.publicationMetrics,
    async (job: Job<PublicationMetricsJobData>) => {
      const { publicationId, campaignHeaderId, triggeredBy } = job.data;

      logMetricsQueueEvent("JOB_STARTED", {
        publicationId,
        jobId: job.id,
        attemptsMade: job.attemptsMade,
      });

      const { metricsCollectorById } = await import(
        "@/lib/performance/metrics-collector/metrics-collector.js"
      );

      const outcome = await metricsCollectorById(supabase, {
        publicationId,
        campaignHeaderId,
        triggeredBy,
        playwrightExtract: async (url, platform) => {
          const raw = await extractPostMetricsWithPlaywright(url, platform);
          return {
            views: raw.views ?? null,
            likes: raw.likes ?? null,
            comments: raw.comments ?? null,
            shares: raw.shares ?? null,
            impressions: raw.views ?? null,
            publicationDate: raw.publicationDate ?? null,
          };
        },
      });

      logMetricsQueueEvent("JOB_COMPLETED", {
        publicationId,
        jobId: job.id,
        provider: outcome.source,
        status: outcome.status,
      });

      return { publicationId, status: outcome.status, source: outcome.source };
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? JOB_ATTEMPTS;
    console.error(
      `[publication-metrics] failed ${job.id} publicationId=${job.data.publicationId} ` +
        `attempt=${job.attemptsMade}/${maxAttempts}`,
      err.message
    );

    await handlePublicationMetricsJobFailure(supabase, {
      publicationId: job.data.publicationId,
      campaignHeaderId: job.data.campaignHeaderId,
      triggeredBy: job.data.triggeredBy,
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts,
      error: err.message,
    });
  });

  return worker;
}
