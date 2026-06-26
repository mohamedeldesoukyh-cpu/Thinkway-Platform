import { shutdownBrowser } from "./browser/browser-pool.js";
import { registerRepeatableJobs } from "./schedulers/refresh-scheduler.js";
import {
  registerPublicationMetricsRepeatableJobs,
  startPublicationMetricsScheduler,
} from "./schedulers/publication-metrics-scheduler.js";
import {
  registerPublicationScreenshotRepeatableJobs,
  startPublicationScreenshotScheduler,
} from "./schedulers/publication-screenshot-scheduler.js";
import { startDiscoveryWorker } from "./workers/discovery.worker.js";
import { startEnrichmentWorker } from "./workers/enrichment.worker.js";
import { startPublicationMetricsWorker } from "./workers/publication-metrics.worker.js";
import { startPublicationScreenshotWorker } from "./workers/publication-screenshot.worker.js";
import { startRefreshWorker } from "./workers/refresh.worker.js";
import { startRefreshScheduler } from "./schedulers/refresh-scheduler.js";
import {
  startCreatorImportEnrichmentWorker,
  startCreatorImportWorker,
} from "./workers/creator-import.worker.js";
import { startCreatorEnrichmentWorker } from "./workers/creator-enrichment.worker.js";

console.log("[discovery-worker] starting Thinkway discovery engine…");

const discoveryWorker = startDiscoveryWorker();
const enrichmentWorker = startEnrichmentWorker();
const refreshWorker = startRefreshWorker();
const schedulerWorker = startRefreshScheduler();
const publicationMetricsWorker = startPublicationMetricsWorker();
const publicationMetricsScheduler = startPublicationMetricsScheduler();
const publicationScreenshotWorker = startPublicationScreenshotWorker();
const publicationScreenshotScheduler = startPublicationScreenshotScheduler();
const creatorImportWorker = startCreatorImportWorker();
const creatorImportEnrichmentWorker = startCreatorImportEnrichmentWorker();
const creatorEnrichmentWorker = startCreatorEnrichmentWorker();

await registerRepeatableJobs();
await registerPublicationMetricsRepeatableJobs();
await registerPublicationScreenshotRepeatableJobs();

discoveryWorker.on("completed", (job) => {
  console.log(`[discovery] completed ${job.id}`, job.returnvalue);
});
discoveryWorker.on("failed", (job, err) => {
  console.error(`[discovery] failed ${job?.id}`, err.message);
});
enrichmentWorker.on("failed", (job, err) => {
  console.error(`[enrichment] failed ${job?.id}`, err.message);
});
publicationMetricsWorker.on("completed", (job) => {
  console.log(`[publication-metrics] completed ${job.id}`, job.returnvalue);
});
publicationMetricsWorker.on("failed", (job, err) => {
  console.error(`[publication-metrics] failed ${job?.id}`, err.message);
});
publicationScreenshotWorker.on("completed", (job) => {
  console.log(`[publication-screenshot] completed ${job.id}`, job.returnvalue);
});
publicationScreenshotWorker.on("failed", (job, err) => {
  console.error(`[publication-screenshot] failed ${job?.id}`, err.message);
});
creatorImportWorker.on("completed", (job) => {
  console.log(`[creator-import] completed ${job.id}`, job.returnvalue);
});
creatorImportWorker.on("failed", (job, err) => {
  console.error(`[creator-import] failed ${job?.id}`, err.message);
});
creatorImportEnrichmentWorker.on("failed", (job, err) => {
  console.error(`[creator-import-enrich] failed ${job?.id}`, err.message);
});
// creator-enrichment worker registers its own failed/completed/DLQ handlers.

async function shutdown(): Promise<void> {
  console.log("[discovery-worker] shutting down…");
  await Promise.all([
    discoveryWorker.close(),
    enrichmentWorker.close(),
    refreshWorker.close(),
    schedulerWorker.close(),
    publicationMetricsWorker.close(),
    publicationMetricsScheduler.close(),
    publicationScreenshotWorker.close(),
    publicationScreenshotScheduler.close(),
    creatorImportWorker.close(),
    creatorImportEnrichmentWorker.close(),
    creatorEnrichmentWorker.close(),
    shutdownBrowser(),
  ]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(
  "[discovery-worker] ready — queues: discovery, enrichment, refresh, scheduler, publication-metrics, publication-screenshot, publication-screenshot-scheduler, creator-import, creator-import-enrich, creator-enrichment"
);
