import { Queue, Worker } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";
import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";

export function startPublicationScreenshotScheduler(): Worker {
  const screenshotQueue = new Queue(QUEUES.publicationScreenshot, {
    connection: getRedisConnection(),
  });

  return new Worker(
    QUEUES.publicationScreenshotScheduler,
    async () => {
      const { data, error } = await supabase
        .from("campaign_publications")
        .select("id, campaign_header_id, screenshot_url, metrics_refresh_status")
        .is("screenshot_url", null)
        .not("content_url", "is", null)
        .in("metrics_refresh_status", ["completed", "partial"])
        .limit(100);

      if (error) throw new Error(error.message);

      let enqueued = 0;
      for (const row of data ?? []) {
        await screenshotQueue.add(
          "capture-screenshot",
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

export async function registerPublicationScreenshotRepeatableJobs(): Promise<void> {
  const schedulerQueue = new Queue(QUEUES.publicationScreenshotScheduler, {
    connection: getRedisConnection(),
  });

  await schedulerQueue.add(
    "publication-screenshot-scan",
    {},
    {
      repeat: { pattern: "*/15 * * * *" },
      removeOnComplete: 10,
      removeOnFail: 5,
      jobId: "publication-screenshot-quarter-hourly-scan",
    }
  );
}
