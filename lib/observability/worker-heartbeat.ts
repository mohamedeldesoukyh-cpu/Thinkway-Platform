import IORedis from "ioredis";

import { getThinkwayEnvironment } from "@/lib/observability/environment";

export const WORKER_HEARTBEAT_KEY = "thinkway:worker:discovery:heartbeat";
export const WORKER_HEARTBEAT_TTL_SEC = 120;
export const WORKER_HEARTBEAT_STALE_MS = 90_000;

export type WorkerHeartbeatPayload = {
  service: "discovery-worker";
  version: string;
  gitSha: string | null;
  environment: string;
  startedAt: string;
  lastBeat: string;
  queues: string[];
};

function getRedisUrl(): string | null {
  return process.env.REDIS_URL?.trim() || null;
}

export function buildWorkerHeartbeatPayload(input: {
  version: string;
  gitSha?: string | null;
  queues: string[];
  startedAt?: string;
}): WorkerHeartbeatPayload {
  const now = new Date().toISOString();
  return {
    service: "discovery-worker",
    version: input.version,
    gitSha: input.gitSha ?? null,
    environment: getThinkwayEnvironment(),
    startedAt: input.startedAt ?? now,
    lastBeat: now,
    queues: input.queues,
  };
}

export async function writeWorkerHeartbeat(
  redis: IORedis,
  payload: WorkerHeartbeatPayload
): Promise<void> {
  await redis.set(
    WORKER_HEARTBEAT_KEY,
    JSON.stringify(payload),
    "EX",
    WORKER_HEARTBEAT_TTL_SEC
  );
}

export async function readWorkerHeartbeat(): Promise<{
  configured: boolean;
  alive: boolean;
  stale: boolean;
  ageMs: number | null;
  payload: WorkerHeartbeatPayload | null;
  error?: string;
}> {
  const url = getRedisUrl();
  if (!url) {
    return {
      configured: false,
      alive: false,
      stale: true,
      ageMs: null,
      payload: null,
      error: "REDIS_URL not configured",
    };
  }

  const redis = new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5_000,
    lazyConnect: true,
    retryStrategy: () => null,
  });

  try {
    redis.on("error", () => {});
    await redis.connect();
    const raw = await redis.get(WORKER_HEARTBEAT_KEY);
    if (!raw) {
      return {
        configured: true,
        alive: false,
        stale: true,
        ageMs: null,
        payload: null,
      };
    }

    const payload = JSON.parse(raw) as WorkerHeartbeatPayload;
    const ageMs = Date.now() - new Date(payload.lastBeat).getTime();
    const alive = ageMs <= WORKER_HEARTBEAT_STALE_MS;

    return {
      configured: true,
      alive,
      stale: !alive,
      ageMs,
      payload,
    };
  } catch (error) {
    return {
      configured: true,
      alive: false,
      stale: true,
      ageMs: null,
      payload: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    redis.disconnect();
  }
}
