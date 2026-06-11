import { Queue } from "bullmq";

import type { DiscoveryJobPayload, EnrichmentJobPayload } from "@/lib/discovery/types";

const QUEUES = {
  discovery: "discovery-run",
  enrichment: "discovery-enrich",
} as const;

function getConnectionOptions() {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url };
}

export function isDiscoveryQueueAvailable(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export async function enqueueDiscoveryJob(
  payload: DiscoveryJobPayload,
  jobId?: string
): Promise<{ queued: boolean; reason?: string }> {
  const connection = getConnectionOptions();
  if (!connection) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const queue = new Queue(QUEUES.discovery, { connection });
  await queue.add("discovery-run", { ...payload, jobId }, {
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  await queue.close();
  return { queued: true };
}

export async function enqueueEnrichmentJob(
  payload: EnrichmentJobPayload,
  jobId?: string
): Promise<{ queued: boolean; reason?: string }> {
  const connection = getConnectionOptions();
  if (!connection) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const queue = new Queue(QUEUES.enrichment, { connection });
  await queue.add("enrich-profile", { ...payload, jobId }, {
    removeOnComplete: 100,
    removeOnFail: 50,
  });
  await queue.close();
  return { queued: true };
}
