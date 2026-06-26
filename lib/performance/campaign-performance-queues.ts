import { Queue } from "bullmq";
import IORedis from "ioredis";

import {
  CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
  DELAYED_JOB_MAX_AGE_MS,
  RECENT_QUEUE_FAILURE_WINDOW_MS,
} from "@/lib/performance/campaign-performance-queue-options";
import { PUBLICATION_METRICS_QUEUE } from "@/lib/performance/metrics-collector/queue";
import { PUBLICATION_SCREENSHOT_QUEUE } from "@/lib/performance/screenshot-capture/config";

export const CAMPAIGN_PERFORMANCE_QUEUES = {
  discovery: "discovery-run",
  publicationMetrics: PUBLICATION_METRICS_QUEUE,
  publicationScreenshot: PUBLICATION_SCREENSHOT_QUEUE,
  performanceReport: "performance-report",
} as const;

export type CampaignPerformanceQueueName =
  (typeof CAMPAIGN_PERFORMANCE_QUEUES)[keyof typeof CAMPAIGN_PERFORMANCE_QUEUES];

export {
  CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
  DELAYED_JOB_MAX_AGE_MS,
  RECENT_QUEUE_FAILURE_WINDOW_MS,
} from "@/lib/performance/campaign-performance-queue-options";

export type QueueStats = {
  name: string;
  active: number;
  waiting: number;
  delayed: number;
  failed: number;
  completed: number;
  paused: number;
  available: boolean;
  error?: string;
};

export type QueueFailureBreakdown = {
  name: string;
  totalFailed: number;
  recentFailed: number;
  historicalFailed: number;
  available: boolean;
  error?: string;
};

export type QueueCleanupResult = {
  name: string;
  cleanedFailed: number;
  cleanedCompleted: number;
  cleanedDelayed: number;
  error?: string;
};

export type RedisHealth = {
  connected: boolean;
  latencyMs: number | null;
  urlConfigured: boolean;
  error?: string;
};

const QUEUE_WAITING_FAIL_THRESHOLD = 1000;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

export function isRedisConfigured(): boolean {
  return Boolean(getRedisUrl());
}

function createQueueConnection(url: string): { url: string } {
  return { url };
}

export async function checkRedisHealth(): Promise<RedisHealth> {
  const url = getRedisUrl();
  if (!url) {
    return { connected: false, latencyMs: null, urlConfigured: false, error: "REDIS_URL not configured" };
  }

  const started = performance.now();
  const redis = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  try {
    redis.on("error", () => {});
    await redis.connect();
    const pong = await redis.ping();
    const latencyMs = Math.round(performance.now() - started);
    return {
      connected: pong === "PONG",
      latencyMs,
      urlConfigured: true,
      error: pong === "PONG" ? undefined : `Unexpected ping response: ${pong}`,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      urlConfigured: true,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    redis.disconnect();
  }
}

export async function getQueueStats(queueName: string): Promise<QueueStats> {
  const url = getRedisUrl();
  if (!url) {
    return {
      name: queueName,
      active: 0,
      waiting: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: 0,
      available: false,
      error: "REDIS_URL not configured",
    };
  }

  const connection = createQueueConnection(url);
  const queue = new Queue(queueName, { connection });

  try {
    const counts = await queue.getJobCounts(
      "active",
      "waiting",
      "delayed",
      "failed",
      "completed",
      "paused"
    );
    return {
      name: queueName,
      active: counts.active ?? 0,
      waiting: counts.waiting ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      paused: counts.paused ?? 0,
      available: true,
    };
  } catch (error) {
    return {
      name: queueName,
      active: 0,
      waiting: 0,
      delayed: 0,
      failed: 0,
      completed: 0,
      paused: 0,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await queue.close();
  }
}

export async function getQueueFailureBreakdown(queueName: string): Promise<QueueFailureBreakdown> {
  const url = getRedisUrl();
  if (!url) {
    return {
      name: queueName,
      totalFailed: 0,
      recentFailed: 0,
      historicalFailed: 0,
      available: false,
      error: "REDIS_URL not configured",
    };
  }

  const connection = createQueueConnection(url);
  const queue = new Queue(queueName, { connection });
  const cutoff = Date.now() - RECENT_QUEUE_FAILURE_WINDOW_MS;

  try {
    const counts = await queue.getJobCounts("failed");
    const totalFailed = counts.failed ?? 0;

    if (totalFailed === 0) {
      return {
        name: queueName,
        totalFailed: 0,
        recentFailed: 0,
        historicalFailed: 0,
        available: true,
      };
    }

    const failedJobs = await queue.getJobs(["failed"], 0, CAMPAIGN_PERFORMANCE_JOB_OPTIONS.removeOnFail - 1);
    let recentFailed = 0;
    let historicalFailed = 0;

    for (const job of failedJobs) {
      const finishedOn = job.finishedOn ?? job.processedOn ?? 0;
      if (finishedOn >= cutoff) {
        recentFailed += 1;
      } else {
        historicalFailed += 1;
      }
    }

    const unclassified = Math.max(0, totalFailed - failedJobs.length);
    historicalFailed += unclassified;

    return {
      name: queueName,
      totalFailed,
      recentFailed,
      historicalFailed,
      available: true,
    };
  } catch (error) {
    return {
      name: queueName,
      totalFailed: 0,
      recentFailed: 0,
      historicalFailed: 0,
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await queue.close();
  }
}

export async function getAllCampaignPerformanceQueueStats(): Promise<QueueStats[]> {
  const names = Object.values(CAMPAIGN_PERFORMANCE_QUEUES);
  return Promise.all(names.map((name) => getQueueStats(name)));
}

export async function getAllQueueFailureBreakdowns(): Promise<QueueFailureBreakdown[]> {
  const names = Object.values(CAMPAIGN_PERFORMANCE_QUEUES);
  return Promise.all(names.map((name) => getQueueFailureBreakdown(name)));
}

export async function cleanCampaignPerformanceQueue(queueName: string): Promise<QueueCleanupResult> {
  const url = getRedisUrl();
  if (!url) {
    return {
      name: queueName,
      cleanedFailed: 0,
      cleanedCompleted: 0,
      cleanedDelayed: 0,
      error: "REDIS_URL not configured",
    };
  }

  const connection = createQueueConnection(url);
  const queue = new Queue(queueName, { connection });

  try {
    const cleanedFailedJobs = await queue.clean(0, 10_000, "failed");
    const cleanedCompletedJobs = await queue.clean(0, 10_000, "completed");
    const cleanedDelayedJobs = await queue.clean(DELAYED_JOB_MAX_AGE_MS, 10_000, "delayed");

    return {
      name: queueName,
      cleanedFailed: cleanedFailedJobs.length,
      cleanedCompleted: cleanedCompletedJobs.length,
      cleanedDelayed: cleanedDelayedJobs.length,
    };
  } catch (error) {
    return {
      name: queueName,
      cleanedFailed: 0,
      cleanedCompleted: 0,
      cleanedDelayed: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await queue.close();
  }
}

export async function cleanAllCampaignPerformanceQueues(): Promise<QueueCleanupResult[]> {
  const names = Object.values(CAMPAIGN_PERFORMANCE_QUEUES);
  return Promise.all(names.map((name) => cleanCampaignPerformanceQueue(name)));
}

/** Backlog-only health — failed job age is evaluated separately. */
export function isQueueStatsHealthy(stats: QueueStats): boolean {
  if (!stats.available) return false;
  if (stats.waiting > QUEUE_WAITING_FAIL_THRESHOLD) return false;
  return true;
}

export function isQueueBacklogHealthy(stats: QueueStats[]): boolean {
  return stats.every(isQueueStatsHealthy);
}

export function totalQueueBacklog(stats: QueueStats[]): number {
  return stats.reduce((sum, q) => sum + q.waiting + q.delayed, 0);
}

export const QUEUE_WAITING_THRESHOLD = QUEUE_WAITING_FAIL_THRESHOLD;
