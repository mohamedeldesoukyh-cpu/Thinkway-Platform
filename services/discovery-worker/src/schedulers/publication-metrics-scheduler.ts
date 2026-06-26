import { Queue, Worker } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";
import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";

export function startPublicationMetricsScheduler(): Worker {
  const metricsQueue = new Queue(QUEUES.publicationMetrics, {
    connection: getRedisConnection(),
  });

  return new Worker(
    QUEUES.publicationMetricsScheduler,
    async () => {
      const { data, error } = await supabase
        .from("campaign_publications")
        .select("id, campaign_header_id, metrics_next_refresh_at, metrics_refresh_status")
        .not("content_url", "is", null)
        .in("metrics_refresh_status", ["queued", "pending", "completed", "partial", "failed"])
        .limit(200);

      if (error) throw new Error(error.message);

      const now = Date.now();
      let enqueued = 0;

      for (const row of data ?? []) {
        const due =
          row.metrics_refresh_status === "queued" ||
          !row.metrics_next_refresh_at ||
          Date.parse(row.metrics_next_refresh_at) <= now;

        if (!due) continue;

        await supabase
          .from("campaign_publications")
          .update({ metrics_refresh_status: "queued", updated_at: new Date().toISOString() })
          .eq("id", row.id);

        await metricsQueue.add(
          "collect-metrics",
          {
            publicationId: row.id,
            campaignHeaderId: row.campaign_header_id,
            triggeredBy: "scheduled_worker",
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
          }
        );
        enqueued += 1;
      }

      return { enqueued };
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );
}

export async function registerPublicationMetricsRepeatableJobs(): Promise<void> {
  const schedulerQueue = new Queue(QUEUES.publicationMetricsScheduler, {
    connection: getRedisConnection(),
  });

  await schedulerQueue.add(
    "publication-metrics-scan",
    {},
    {
      repeat: { pattern: "0 * * * *" },
      removeOnComplete: 10,
      removeOnFail: 5,
      jobId: "publication-metrics-hourly-scan",
    }
  );
}
