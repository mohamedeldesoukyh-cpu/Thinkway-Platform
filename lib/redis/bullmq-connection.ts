import type { ConnectionOptions } from "bullmq";

/**
 * Build the BullMQ Redis connection options for web-app PRODUCERS, resolving
 * to the same server/db as the discovery-worker consumer
 * (services/discovery-worker/src/queues/connection.ts, `new IORedis(url)`).
 *
 * WHY THIS EXISTS — the previous producers passed `{ connection: { url } }` to
 * BullMQ. ioredis has NO `url` option key: it silently ignores it and falls
 * back to localhost:6379/db0, so whenever REDIS_URL pointed anywhere else the
 * web app enqueued to a Redis the worker never read (jobs reported
 * "queued: true" yet were never consumed). Parsing the URL into explicit
 * host/port/auth/db options guarantees producer and consumer land on the same
 * Redis. BullMQ owns the resulting connection, so `queue.close()` fully cleans
 * it up (no separate lifecycle management).
 */
export function createBullMqQueueConnection(url: string): ConnectionOptions {
  const parsed = new URL(url);
  const dbSegment = parsed.pathname.replace(/^\//, "");
  const db = dbSegment ? Number(dbSegment) : 0;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number.isFinite(db) ? db : 0,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    // Same behavior options as the worker's ioredis construction.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}
