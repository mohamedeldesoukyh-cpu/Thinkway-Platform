import {
  getCreatorEnrichmentQueueStats,
  isCreatorEnrichmentQueueAvailable,
} from "./queue";

export type CreatorEnrichmentQueueHealth = {
  redisConfigured: boolean;
  queueReachable: boolean;
  waiting: number;
  active: number;
  delayed: number;
  /** Waiting jobs with no active workers — likely discovery-worker offline. */
  workerLikelyOffline: boolean;
  message: string | null;
};

/**
 * Lightweight queue health for Discovery UI. Does not prove a worker is running,
 * but surfaces the common "jobs piling up with zero active" case.
 */
export async function getCreatorEnrichmentQueueHealth(): Promise<CreatorEnrichmentQueueHealth> {
  const redisConfigured = isCreatorEnrichmentQueueAvailable();
  if (!redisConfigured) {
    return {
      redisConfigured: false,
      queueReachable: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      workerLikelyOffline: true,
      message:
        "Enrichment queue is not configured (REDIS_URL missing). Start discovery-worker after setting REDIS_URL.",
    };
  }

  const stats = await getCreatorEnrichmentQueueStats();
  if (!stats) {
    return {
      redisConfigured: true,
      queueReachable: false,
      waiting: 0,
      active: 0,
      delayed: 0,
      workerLikelyOffline: true,
      message: "Could not reach Redis for the enrichment queue.",
    };
  }

  const workerLikelyOffline =
    stats.waiting + stats.delayed > 0 && stats.active === 0;

  return {
    redisConfigured: true,
    queueReachable: true,
    waiting: stats.waiting,
    active: stats.active,
    delayed: stats.delayed,
    workerLikelyOffline,
    message: workerLikelyOffline
      ? `${stats.waiting + stats.delayed} enrichment job(s) waiting — discovery-worker may be offline. Run npm run discovery-worker.`
      : null,
  };
}
