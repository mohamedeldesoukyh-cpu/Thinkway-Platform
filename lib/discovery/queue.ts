import { Queue } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";
import type { EnterpriseAcquisitionJobData } from "@/lib/discovery/enterprise-acquisition-types";
import type { DiscoveryJobPayload, EnrichmentJobPayload } from "@/lib/discovery/types";
import { createBullMqQueueConnection } from "@/lib/redis/bullmq-connection";

export const DISCOVERY_QUEUE_NAMES = {
  discovery: "discovery-run",
  enrichment: "discovery-enrich",
  enterpriseAcquisition: "enterprise-acquisition",
} as const;

const QUEUES = DISCOVERY_QUEUE_NAMES;

export function isDiscoveryQueueAvailable(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Enqueue via a connection built EXACTLY like the discovery-worker consumer's,
 * so producer and worker always target the same Redis server/db. (The previous
 * `{ connection: { url } }` form was silently ignored by ioredis and fell back
 * to localhost — jobs reported queued but the worker never saw them.)
 */
async function enqueue(
  queueName: string,
  jobName: string,
  data: Record<string, unknown>,
  options: Record<string, unknown>
): Promise<{ queued: boolean; reason?: string }> {
  const url = process.env.REDIS_URL;
  if (!url) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }

  const queue = new Queue(queueName, { connection: createBullMqQueueConnection(url) });
  try {
    await queue.add(jobName, data, options);
    return { queued: true };
  } finally {
    await queue.close();
  }
}

export async function enqueueDiscoveryJob(
  payload: DiscoveryJobPayload,
  jobId?: string
): Promise<{ queued: boolean; reason?: string }> {
  return enqueue(
    QUEUES.discovery,
    "discovery-run",
    { ...payload, jobId },
    CAMPAIGN_PERFORMANCE_JOB_OPTIONS
  );
}

export async function enqueueEnrichmentJob(
  payload: EnrichmentJobPayload,
  jobId?: string
): Promise<{ queued: boolean; reason?: string }> {
  return enqueue(
    QUEUES.enrichment,
    "enrich-profile",
    { ...payload, jobId },
    CAMPAIGN_PERFORMANCE_JOB_OPTIONS
  );
}

export async function enqueueEnterpriseAcquisitionJob(
  payload: EnterpriseAcquisitionJobData
): Promise<{ queued: boolean; reason?: string }> {
  return enqueue(QUEUES.enterpriseAcquisition, "enterprise-acquisition", payload, {
    ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,
    jobId: payload.jobId,
  });
}
