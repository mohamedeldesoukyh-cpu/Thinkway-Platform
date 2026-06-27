import { Queue } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";
import { logMetricsQueueEvent } from "@/lib/performance/metrics-collector/metrics-queue-log";

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
      connection: { url: redisUrl },
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

  logMetricsQueueEvent("JOB_QUEUED", {
    publicationId: data.publicationId,
    jobId: job.id,
    status: "queued",
  });

  return { enqueued: true, jobId: job.id };
}

export async function publicationHasInflightMetricsJob(
  publicationId: string
): Promise<boolean> {
  const q = getQueue();
  if (!q) return false;

  const jobs = await q.getJobs(["active", "waiting"], 0, 499);
  return jobs.some((job) => job.data.publicationId === publicationId);
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
