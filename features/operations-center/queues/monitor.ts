import { Queue } from "bullmq";

import { DISCOVERY_WORKER_QUEUES } from "@/lib/observability/discovery-queues";
import {
  getQueueStats,
  isRedisConfigured,
} from "@/lib/performance/campaign-performance-queues";
import { createBullMqQueueConnection } from "@/lib/redis/bullmq-connection";

import type { QueueMonitorRow } from "../types";

export async function collectQueueMonitorRows(): Promise<QueueMonitorRow[]> {
  if (!isRedisConfigured()) {
    return DISCOVERY_WORKER_QUEUES.map((name) => ({
      name,
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      retries: 0,
      deadLetter: 0,
      available: false,
      oldestWaitingAgeMs: null,
      longestRunningAgeMs: null,
      throughputHint: "Redis not configured",
      error: "REDIS_URL not configured",
    }));
  }

  const url = process.env.REDIS_URL!.trim();
  // Options object only — BullMQ owns the ioredis client lifecycle via queue.close().
  const connection = createBullMqQueueConnection(url);
  const rows: QueueMonitorRow[] = [];

  for (const name of DISCOVERY_WORKER_QUEUES) {
    const stats = await getQueueStats(name);
    const queue = new Queue(name, { connection });
    let oldestWaitingAgeMs: number | null = null;
    let longestRunningAgeMs: number | null = null;
    try {
      const [waitingJobs, activeJobs] = await Promise.all([
        queue.getJobs(["waiting"], 0, 0),
        queue.getJobs(["active"], 0, 0),
      ]);
      const waitingTs = waitingJobs[0]?.timestamp;
      const activeTs = activeJobs[0]?.processedOn ?? activeJobs[0]?.timestamp;
      if (waitingTs) oldestWaitingAgeMs = Math.max(0, Date.now() - waitingTs);
      if (activeTs) longestRunningAgeMs = Math.max(0, Date.now() - activeTs);
    } catch {
      // ignore age probe failures
    } finally {
      await queue.close().catch(() => undefined);
    }

    const deadLetter =
      name === "creator-enrichment-dlq" ? stats.waiting + stats.failed : 0;

    rows.push({
      name: stats.name,
      waiting: stats.waiting,
      active: stats.active,
      completed: stats.completed,
      failed: stats.failed,
      delayed: stats.delayed,
      paused: stats.paused,
      retries: stats.delayed,
      deadLetter,
      available: stats.available,
      oldestWaitingAgeMs,
      longestRunningAgeMs,
      throughputHint:
        stats.completed > 0
          ? `${stats.completed} completed (retained window)`
          : "No completed jobs in retention window",
      error: stats.error,
    });
  }

  return rows;
}

export function summarizeQueueTotals(
  rows: QueueMonitorRow[],
  workerCount = 0,
) {
  return rows.reduce(
    (acc, q) => ({
      waiting: acc.waiting + q.waiting,
      active: acc.active + q.active,
      completed: acc.completed + q.completed,
      failed: acc.failed + q.failed,
      delayed: acc.delayed + q.delayed,
      deadLetter: acc.deadLetter + q.deadLetter,
      retries: acc.retries + q.retries,
      workerCount: acc.workerCount,
    }),
    {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      deadLetter: 0,
      retries: 0,
      workerCount,
    },
  );
}
