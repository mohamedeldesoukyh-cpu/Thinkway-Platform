import {
  buildWorkerHeartbeatPayload,
  writeWorkerHeartbeat,
} from "@/lib/observability/worker-heartbeat.js";
import { logError, logInfo } from "@/lib/observability/structured-logger.js";

import { getRedisConnection } from "../queues/connection.js";

const HEARTBEAT_INTERVAL_MS = 30_000;
const WORKER_VERSION = process.env.npm_package_version ?? "0.1.0";

export function startWorkerHeartbeat(queues: string[]): () => void {
  const redis = getRedisConnection();
  const startedAt = new Date().toISOString();
  const gitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_SHA ??
    null;

  logInfo("discovery-worker", "worker starting", {
    service: "discovery-worker",
    version: WORKER_VERSION,
    gitSha,
    queues,
  });

  const beat = async () => {
    try {
      const payload = buildWorkerHeartbeatPayload({
        version: WORKER_VERSION,
        gitSha,
        queues,
        startedAt,
      });
      await writeWorkerHeartbeat(redis, payload);
    } catch (error) {
      logError("discovery-worker", "heartbeat write failed", {
        service: "discovery-worker",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  void beat();
  const timer = setInterval(() => {
    void beat();
  }, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(timer);
}
