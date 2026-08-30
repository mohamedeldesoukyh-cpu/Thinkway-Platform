import { Queue } from "bullmq";

import {
  createCreatorEnrichmentQueueConnection,
  getCreatorEnrichmentRedisUrl,
} from "@/lib/creator-enrichment/queue-connection";

export const CREATOR_SOCIAL_SYNC_QUEUE = "creator-social-sync";

export type CreatorSocialSyncJob = {
  connectionId: string;
  influencerId: string;
  trigger: "initial" | "manual" | "retry";
};

export function creatorSocialSyncJobId(connectionId: string): string {
  return `creator-social-sync-${connectionId}`;
}

export async function enqueueCreatorSocialSync(
  payload: CreatorSocialSyncJob
): Promise<{ queued: boolean; reason?: string }> {
  const redisUrl = getCreatorEnrichmentRedisUrl();
  if (!redisUrl) {
    return { queued: false, reason: "REDIS_URL not configured" };
  }
  const connection = createCreatorEnrichmentQueueConnection(redisUrl);
  const queue = new Queue(CREATOR_SOCIAL_SYNC_QUEUE, { connection });
  try {
    await queue.add("sync", payload, {
      jobId: creatorSocialSyncJobId(payload.connectionId),
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    });
    return { queued: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "queue_add_failed";
    if (/already exists|Job is already waiting|duplicate/i.test(message)) {
      return { queued: true, reason: "already_queued" };
    }
    return { queued: false, reason: message };
  } finally {
    await queue.close();
  }
}
