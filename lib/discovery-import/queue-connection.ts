/**
 * Shared Redis connection for creator-import BullMQ producers.
 * Delegates to createBullMqQueueConnection so web app and discovery-worker
 * always target the same Redis host/db (never `{ url }` → localhost fallback).
 */

import type { ConnectionOptions } from "bullmq";

import { createBullMqQueueConnection } from "@/lib/redis/bullmq-connection";

export function getCreatorImportRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

/** Same connection options as discovery / enrichment / metrics producers. */
export function getConnectionOptions(): ConnectionOptions | null {
  const url = getCreatorImportRedisUrl();
  if (!url) return null;
  return createBullMqQueueConnection(url);
}
