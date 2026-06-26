import { Queue } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";

import type {
  CreatorImportEnrichmentJobPayload,
  CreatorImportJobPayload,
} from "./types";

export const CREATOR_IMPORT_QUEUES = {
  import: "creator-import",
  enrich: "creator-import-enrich",
} as const;

function getConnectionOptions() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

export function isCreatorImportQueueAvailable(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function enqueueCreatorImportJob(
  payload: CreatorImportJobPayload
): Promise<{ queued: boolean; reason?: string; jobId?: string }> {
  const connection = getConnectionOptions();
  if (!connection) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const queue = new Queue(CREATOR_IMPORT_QUEUES.import, { connection });
  const job = await queue.add(
    "process-import",
    payload,
    {
      ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
      jobId: `creator-import-${payload.importFileId}`,
    }
  );
  await queue.close();
  return { queued: true, jobId: job.id };
}

export async function enqueueCreatorImportEnrichmentJob(
  payload: CreatorImportEnrichmentJobPayload
): Promise<{ queued: boolean; reason?: string }> {
  const connection = getConnectionOptions();
  if (!connection) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const queue = new Queue(CREATOR_IMPORT_QUEUES.enrich, { connection });
  await queue.add(
    "enrich-imported-creator",
    payload,
    {
      ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
      jobId: `creator-import-enrich-${payload.platformAccountId}`,
    }
  );
  await queue.close();
  return { queued: true };
}
