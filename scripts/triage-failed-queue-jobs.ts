#!/usr/bin/env node
/**
 * Triage failed BullMQ jobs across discovery worker queues.
 * Run: npx tsx scripts/triage-failed-queue-jobs.ts [--retry] [--clean]
 */
import "@/lib/performance/script-env-preload";

import { Queue } from "bullmq";

import { DISCOVERY_WORKER_QUEUES } from "@/lib/observability/discovery-queues";
import { requireScriptEnvVars } from "@/lib/performance/script-env";

type FailedJobReport = {
  queue: string;
  jobId: string;
  name: string;
  attemptsMade: number;
  failedReason: string;
  finishedOn: string | null;
  dataPreview: string;
};

async function main(): Promise<void> {
  requireScriptEnvVars(["REDIS_URL"]);
  const redisUrl = process.env.REDIS_URL!.trim();
  const shouldRetry = process.argv.includes("--retry");
  const shouldClean = process.argv.includes("--clean");

  const reports: FailedJobReport[] = [];
  let totalFailed = 0;

  console.log("\n=== Failed BullMQ Job Triage ===\n");

  for (const queueName of DISCOVERY_WORKER_QUEUES) {
    const queue = new Queue(queueName, { connection: { url: redisUrl } });
    try {
      const counts = await queue.getJobCounts("failed");
      const failed = counts.failed ?? 0;
      if (failed === 0) {
        console.log(`${queueName}: 0 failed`);
        continue;
      }

      totalFailed += failed;
      console.log(`${queueName}: ${failed} failed`);

      const jobs = await queue.getJobs(["failed"], 0, Math.max(0, failed - 1));
      for (const job of jobs) {
        const report: FailedJobReport = {
          queue: queueName,
          jobId: String(job.id),
          name: job.name,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason ?? "unknown",
          finishedOn: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          dataPreview: JSON.stringify(job.data).slice(0, 200),
        };
        reports.push(report);
        console.log(
          `  [${report.jobId}] ${report.name} attempts=${report.attemptsMade} @ ${report.finishedOn}`
        );
        console.log(`    reason: ${report.failedReason.slice(0, 240)}`);
        console.log(`    data: ${report.dataPreview}`);

        if (shouldRetry) {
          try {
            await job.retry();
            console.log(`    retry: QUEUED`);
          } catch (retryErr) {
            console.log(
              `    retry: FAILED — ${retryErr instanceof Error ? retryErr.message : retryErr}`
            );
          }
        }

        if (shouldClean) {
          try {
            await job.remove();
            console.log(`    clean: REMOVED`);
          } catch (cleanErr) {
            console.log(
              `    clean: FAILED — ${cleanErr instanceof Error ? cleanErr.message : cleanErr}`
            );
          }
        }
      }
    } finally {
      await queue.close();
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Total failed jobs: ${totalFailed}`);
  console.log(`Jobs inspected: ${reports.length}`);

  const byReason = new Map<string, number>();
  for (const r of reports) {
    const key = r.failedReason.slice(0, 80);
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  if (byReason.size > 0) {
    console.log("\nFailure patterns:");
    for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  (${count}x) ${reason}`);
    }
  }

  if (totalFailed > 0 && !shouldRetry && !shouldClean) {
    console.log("\nOps: re-run with --retry or --clean to remediate historical failures.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
