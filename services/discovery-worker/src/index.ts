import "./config.js";
import { assertWorkerRuntimeGuards } from "./runtime-guards.js";

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

  startCreatorImportChunkWorker,

  startCreatorImportWorker,

} from "./workers/creator-import.worker.js";

import { startBatchProfileAcquisitionWorker } from "./workers/batch-profile-acquisition.worker.js";

import { startCreatorEnrichmentWorker } from "./workers/creator-enrichment.worker.js";

import { startEnterpriseAcquisitionWorker } from "./workers/enterprise-acquisition.worker.js";

import { startWorkerHeartbeat } from "./observability/heartbeat.js";

import { isCreatorEnrichmentWorkerEnabled } from "@/lib/creator-enrichment/enabled.js";

import { recoverStuckCreatorEnrichments } from "@/lib/creator-enrichment/recover-stuck-enrichments.js";

import { recoverStuckCreatorImportFiles } from "@/lib/discovery-import/recover-stuck-imports.js";

import { isAutomaticEnrichmentAndAcquisitionDisabled } from "@/lib/discovery/operational-safety.js";

import { supabase } from "./db/supabase.js";

import type { Worker } from "bullmq";



console.log("[discovery-worker] starting Thinkway discovery engine…");

// Fail-fast before any BullMQ consumers register.
assertWorkerRuntimeGuards();

const creatorEnrichmentEnabled = isCreatorEnrichmentWorkerEnabled();

if (!creatorEnrichmentEnabled) {
  console.log(
    "[discovery-worker] creator enrichment disabled — skipping creator-enrichment worker (set ALLOW_MANUAL_ENRICHMENT=true and remove DISABLE_CREATOR_ENRICHMENT to enable manual refresh)"
  );
}

const automaticAcquisitionDisabled = isAutomaticEnrichmentAndAcquisitionDisabled();
if (automaticAcquisitionDisabled) {
  console.warn(
    "[discovery-worker] DISABLE_AUTOMATIC_ENRICHMENT_AND_ACQUISITION=true — automatic acquisition, coverage backfill, and legacy discovery-enrich scheduler are blocked; manual creator refresh remains available"
  );
}



const discoveryWorker = startDiscoveryWorker();

const enrichmentWorker = startEnrichmentWorker();

const refreshWorker = startRefreshWorker();

const schedulerWorker = startRefreshScheduler();

const publicationMetricsWorker = startPublicationMetricsWorker();

const publicationMetricsScheduler = startPublicationMetricsScheduler();

const publicationScreenshotWorker = startPublicationScreenshotWorker();

const publicationScreenshotScheduler = startPublicationScreenshotScheduler();

const creatorImportWorker = startCreatorImportWorker();

const creatorImportChunkWorker = startCreatorImportChunkWorker();

const enterpriseAcquisitionWorker = startEnterpriseAcquisitionWorker();

const batchProfileAcquisitionWorker = startBatchProfileAcquisitionWorker();

const creatorEnrichmentWorker: Worker | null = creatorEnrichmentEnabled

  ? startCreatorEnrichmentWorker()

  : null;



await registerRepeatableJobs();

await registerPublicationMetricsRepeatableJobs();

await registerPublicationScreenshotRepeatableJobs();



try {

  if (creatorEnrichmentEnabled) {

    const enrichmentRecovery = await recoverStuckCreatorEnrichments(supabase, {

      limit: 2000,

    });

    if (enrichmentRecovery.queuedReset > 0 || enrichmentRecovery.runningFailed > 0) {

      console.log(

        "[discovery-worker] cleared stuck enrichment statuses",

        JSON.stringify(enrichmentRecovery)

      );

    }

  }



  const importRecovery = await recoverStuckCreatorImportFiles(supabase, { limit: 500 });

  if (importRecovery.resetToUploaded > 0 || importRecovery.requeuedProcessing > 0) {

    console.log(

      "[discovery-worker] recovered stuck import files",

      JSON.stringify(importRecovery)

    );

  }

} catch (recoveryError) {

  console.error(

    "[discovery-worker] stuck-status recovery failed",

    recoveryError instanceof Error ? recoveryError.message : recoveryError

  );

}



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

creatorImportChunkWorker.on("completed", (job) => {

  console.log(`[creator-import-chunk] completed ${job.id}`, job.returnvalue);

});

creatorImportChunkWorker.on("failed", (job, err) => {

  console.error(`[creator-import-chunk] failed ${job?.id}`, err.message);

});

enterpriseAcquisitionWorker.on("completed", (job) => {

  console.log(`[enterprise-acquisition] completed ${job.id}`, job.returnvalue);

});

enterpriseAcquisitionWorker.on("failed", (job, err) => {

  console.error(`[enterprise-acquisition] failed ${job?.id}`, err.message);

});

batchProfileAcquisitionWorker.on("completed", (job) => {

  console.log(`[batch-profile-acquisition] completed ${job.id}`, job.returnvalue);

});

batchProfileAcquisitionWorker.on("failed", (job, err) => {

  console.error(`[batch-profile-acquisition] failed ${job?.id}`, err.message);

});

// creator-enrichment worker registers its own failed/completed/DLQ handlers when enabled.



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

    creatorImportChunkWorker.close(),

    enterpriseAcquisitionWorker.close(),

    batchProfileAcquisitionWorker.close(),

    creatorEnrichmentWorker?.close(),

    shutdownBrowser(),

  ]);

  process.exit(0);

}



process.on("SIGINT", shutdown);

process.on("SIGTERM", shutdown);



const readyQueues = [

  "discovery",

  "enrichment",

  "refresh",

  "scheduler",

  "publication-metrics",

  "publication-screenshot",

  "publication-screenshot-scheduler",

  "creator-import",

  "creator-import-chunk",

  "enterprise-acquisition",

  "batch-profile-acquisition",

  ...(creatorEnrichmentEnabled ? ["creator-enrichment"] : []),

].join(", ");



console.log(`[discovery-worker] ready — queues: ${readyQueues}`);

startWorkerHeartbeat(readyQueues.split(", "));

