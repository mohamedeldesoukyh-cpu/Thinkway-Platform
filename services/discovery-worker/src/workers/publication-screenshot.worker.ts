import { Worker, type Job } from "bullmq";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";
import { withPage } from "../browser/browser-pool.js";

export type PublicationScreenshotJobData = {
  publicationId: string;
  campaignHeaderId: string;
  triggeredBy: string;
};

async function capturePageScreenshot(url: string): Promise<Buffer | null> {
  return withPage(async (page) => {
    await page.waitForTimeout(1500);
    const buffer = await page.screenshot({ type: "png", fullPage: false });
    return Buffer.from(buffer);
  }, url);
}

export function startPublicationScreenshotWorker(): Worker<PublicationScreenshotJobData> {
  return new Worker<PublicationScreenshotJobData>(
    QUEUES.publicationScreenshot,
    async (job: Job<PublicationScreenshotJobData>) => {
      const { capturePublicationScreenshotById } = await import(
        "@/lib/performance/screenshot-capture/capture.js"
      );

      const outcome = await capturePublicationScreenshotById(supabase, {
        publicationId: job.data.publicationId,
        campaignHeaderId: job.data.campaignHeaderId,
        triggeredBy: job.data.triggeredBy as "metrics_collected" | "manual_refresh" | "scheduled_worker",
        playwrightCapture: capturePageScreenshot,
      });

      return {
        publicationId: outcome.publicationId,
        status: outcome.status,
        source: outcome.source,
      };
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
