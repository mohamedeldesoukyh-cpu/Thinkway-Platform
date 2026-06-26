import { Queue } from "bullmq";
import IORedis from "ioredis";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";
import { PUBLICATION_SCREENSHOT_QUEUE } from "@/lib/performance/screenshot-capture/config";
import type { PublicationScreenshotJobData } from "@/lib/performance/screenshot-capture/types";

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
};

let queue: Queue<PublicationScreenshotJobData> | null = null;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

function getQueue(): Queue<PublicationScreenshotJobData> | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  if (!queue) {
    queue = new Queue(PUBLICATION_SCREENSHOT_QUEUE, {
      connection: new IORedis(redisUrl, { maxRetriesPerRequest: null }) as never,
    });
  }
  return queue;
}

export async function enqueuePublicationScreenshotJob(
  data: PublicationScreenshotJobData
): Promise<{ enqueued: boolean; jobId?: string }> {
  const q = getQueue();
  if (!q) return { enqueued: false };

  const job = await q.add("capture-screenshot", data, JOB_OPTIONS);
  return { enqueued: true, jobId: job.id };
}

export function isScreenshotQueueAvailable(): boolean {
  return Boolean(getRedisUrl());
}
