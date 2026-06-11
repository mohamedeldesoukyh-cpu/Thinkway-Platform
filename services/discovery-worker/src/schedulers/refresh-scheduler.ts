import { Queue, Worker } from "bullmq";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";

export function startRefreshScheduler(): Worker {
  const refreshQueue = new Queue(QUEUES.refresh, {
    connection: getRedisConnection(),
  });

  return new Worker(
    QUEUES.scheduler,
    async () => {
      await refreshQueue.add(
        "daily-refresh-scan",
        {},
        { removeOnComplete: 20, removeOnFail: 10 }
      );
      return { scheduled: true };
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );
}

export async function registerRepeatableJobs(): Promise<void> {
  const schedulerQueue = new Queue(QUEUES.scheduler, {
    connection: getRedisConnection(),
  });

  await schedulerQueue.add(
    "refresh-cron",
    {},
    {
      repeat: { pattern: "0 */6 * * *" },
      removeOnComplete: 10,
      removeOnFail: 5,
      jobId: "discovery-refresh-cron",
    }
  );
}
