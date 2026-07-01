/**
 * Emergency drain for Discovery enrichment/import BullMQ queues.
 * Removes waiting, delayed, paused, and active jobs — does not touch DB rows.
 */

import { Queue } from "bullmq";

import {
  CREATOR_ENRICHMENT_DLQ,
  CREATOR_ENRICHMENT_QUEUE,
} from "./constants";
import { CREATOR_IMPORT_QUEUES } from "@/lib/discovery-import/queue";

export type QueueDrainResult = {
  name: string;
  removed: number;
  error?: string;
};

const DISCOVERY_ENRICHMENT_QUEUES = [
  CREATOR_ENRICHMENT_QUEUE,
  CREATOR_ENRICHMENT_DLQ,
  CREATOR_IMPORT_QUEUES.import,
  CREATOR_IMPORT_QUEUES.chunk,
  CREATOR_IMPORT_QUEUES.enrich,
] as const;

function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

async function drainQueue(name: string, url: string): Promise<QueueDrainResult> {
  const queue = new Queue(name, { connection: { url } });
  let removed = 0;

  try {
    const states = ["waiting", "delayed", "paused", "active"] as const;
    for (const state of states) {
      const jobs = await queue.getJobs([state], 0, 10_000);
      for (const job of jobs) {
        try {
          if (state === "active") {
            await job.discard();
          }
          await job.remove();
          removed += 1;
        } catch {
          // Best-effort per job.
        }
      }
    }

    await queue.clean(0, 10_000, "failed");
    await queue.clean(0, 10_000, "completed");
  } catch (error) {
    return {
      name,
      removed,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await queue.close().catch(() => {});
  }

  return { name, removed };
}

/** Drain all Discovery enrichment/import queues. Returns per-queue removal counts. */
export async function clearDiscoveryEnrichmentQueues(): Promise<QueueDrainResult[]> {
  const url = getRedisUrl();
  if (!url) {
    return DISCOVERY_ENRICHMENT_QUEUES.map((name) => ({
      name,
      removed: 0,
      error: "REDIS_URL not configured",
    }));
  }

  return Promise.all(DISCOVERY_ENRICHMENT_QUEUES.map((name) => drainQueue(name, url)));
}
