/**
 * Shared Redis connection for creator-enrichment BullMQ producers.
 * Delegates to the same factory used by publication queues so web app and
 * discovery-worker always target the same Redis host/db.
 */

import type { ConnectionOptions } from "bullmq";

import { createBullMqQueueConnection } from "@/lib/redis/bullmq-connection";

export function getCreatorEnrichmentRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

export function isCreatorEnrichmentRedisConfigured(): boolean {
  return Boolean(getCreatorEnrichmentRedisUrl());
}

/** Same connection options as publication / discovery producers. */
export function createCreatorEnrichmentQueueConnection(url: string): ConnectionOptions {
  return createBullMqQueueConnection(url);
}
