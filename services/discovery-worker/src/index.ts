import { shutdownBrowser } from "./browser/browser-pool.js";
import { registerRepeatableJobs } from "./schedulers/refresh-scheduler.js";
import { startDiscoveryWorker } from "./workers/discovery.worker.js";
import { startEnrichmentWorker } from "./workers/enrichment.worker.js";
import { startRefreshWorker } from "./workers/refresh.worker.js";
import { startRefreshScheduler } from "./schedulers/refresh-scheduler.js";

console.log("[discovery-worker] starting Thinkway discovery engine…");

const discoveryWorker = startDiscoveryWorker();
const enrichmentWorker = startEnrichmentWorker();
const refreshWorker = startRefreshWorker();
const schedulerWorker = startRefreshScheduler();

await registerRepeatableJobs();

discoveryWorker.on("completed", (job) => {
  console.log(`[discovery] completed ${job.id}`, job.returnvalue);
});
discoveryWorker.on("failed", (job, err) => {
  console.error(`[discovery] failed ${job?.id}`, err.message);
});
enrichmentWorker.on("failed", (job, err) => {
  console.error(`[enrichment] failed ${job?.id}`, err.message);
});

async function shutdown(): Promise<void> {
  console.log("[discovery-worker] shutting down…");
  await Promise.all([
    discoveryWorker.close(),
    enrichmentWorker.close(),
    refreshWorker.close(),
    schedulerWorker.close(),
    shutdownBrowser(),
  ]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[discovery-worker] ready — queues: discovery, enrichment, refresh, scheduler");
