import { Worker, type Job } from "bullmq";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";
import { extractPostMetricsWithPlaywright } from "../metrics/playwright-extract.js";

export type PublicationMetricsJobData = {
  publicationId: string;
  campaignHeaderId: string;
  triggeredBy: string;
};

export function startPublicationMetricsWorker(): Worker<PublicationMetricsJobData> {
  return new Worker<PublicationMetricsJobData>(
    QUEUES.publicationMetrics,
    async (job: Job<PublicationMetricsJobData>) => {
      const { publicationId, campaignHeaderId, triggeredBy } = job.data;

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

      return { publicationId, status: outcome.status, source: outcome.source };
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
