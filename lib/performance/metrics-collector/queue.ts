import { Queue } from "bullmq";
import IORedis from "ioredis";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";

export const PUBLICATION_METRICS_QUEUE = "publication-metrics";

export type PublicationMetricsJobData = {
  publicationId: string;
  campaignHeaderId: string;
  triggeredBy: string;
};

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 5000 },
  ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
};

let queue: Queue<PublicationMetricsJobData> | null = null;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

function getQueue(): Queue<PublicationMetricsJobData> | null {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  if (!queue) {
    queue = new Queue(PUBLICATION_METRICS_QUEUE, {
      connection: new IORedis(redisUrl, { maxRetriesPerRequest: null }),
    });
  }
  return queue;
}

export async function enqueuePublicationMetricsJob(
  data: PublicationMetricsJobData
): Promise<{ enqueued: boolean; jobId?: string }> {
  const q = getQueue();
  if (!q) return { enqueued: false };

  const job = await q.add("collect-metrics", data, JOB_OPTIONS);
  return { enqueued: true, jobId: job.id };
}

export async function enqueuePublicationMetricsBulk(
  jobs: PublicationMetricsJobData[]
): Promise<{ enqueued: number }> {
  const q = getQueue();
  if (!q || jobs.length === 0) return { enqueued: 0 };

  await q.addBulk(
    jobs.map((data) => ({
      name: "collect-metrics",
      data,
      opts: JOB_OPTIONS,
    }))
  );

  return { enqueued: jobs.length };
}

export function isMetricsQueueAvailable(): boolean {
  return Boolean(getRedisUrl());
}
