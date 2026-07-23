import type { SupabaseClient } from "@supabase/supabase-js";

import {
  areApifyBudgetCapsConfigured,
  resolveApifyBudgetCaps,
} from "@/lib/discovery/control-center/apify-budget";
import { getDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import { getThinkwayEnvironment } from "@/lib/observability/environment";
import { DISCOVERY_WORKER_QUEUES } from "@/lib/observability/discovery-queues";
import { readWorkerHeartbeat } from "@/lib/observability/worker-heartbeat";
import {
  checkRedisHealth,
  getAllCampaignPerformanceQueueStats,
  isRedisConfigured,
  type QueueStats,
  type RedisHealth,
} from "@/lib/performance/campaign-performance-queues";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { PUBLICATION_MEDIA_BUCKET } from "@/lib/performance/screenshot-capture/config";
import { getBuildInfo } from "@/lib/deploy/build-info";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type DatabaseHealth = {
  connected: boolean;
  latencyMs: number | null;
  error?: string;
};

export type StorageHealth = {
  configured: boolean;
  reachable: boolean;
  bucket: string;
  latencyMs: number | null;
  error?: string;
};

export type WorkerHealth = {
  redisConfigured: boolean;
  heartbeatConfigured: boolean;
  alive: boolean;
  stale: boolean;
  ageMs: number | null;
  version: string | null;
  gitSha: string | null;
  queues: string[];
  error?: string;
};

export type ApifyReadiness = {
  tokenConfigured: boolean;
  maxRequestsPerDay: number | null;
  maxCreditsPerDay: number | null;
  budgetConfigured: boolean;
  /** When false, live Refresh cannot call Apify actors (fail-closed). */
  liveAcquisitionAllowed: boolean;
};

export type ReadinessReport = {
  status: HealthStatus;
  environment: string;
  timestamp: string;
  database: DatabaseHealth;
  redis: RedisHealth;
  storage: StorageHealth;
  worker: WorkerHealth;
  apify: ApifyReadiness;
  queues: {
    configured: boolean;
    stats: QueueStats[];
    totals: {
      active: number;
      waiting: number;
      failed: number;
      delayed: number;
    };
  };
  build: ReturnType<typeof getBuildInfo>;
};

async function checkDatabaseHealth(
  supabase: SupabaseClient
): Promise<DatabaseHealth> {
  const started = performance.now();
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    const latencyMs = Math.round(performance.now() - started);
    if (error) {
      return { connected: false, latencyMs, error: error.message };
    }
    return { connected: true, latencyMs };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkStorageHealth(
  supabase: SupabaseClient
): Promise<StorageHealth> {
  const started = performance.now();
  try {
    const { error } = await supabase.storage.from(PUBLICATION_MEDIA_BUCKET).list("", {
      limit: 1,
    });
    const latencyMs = Math.round(performance.now() - started);
    if (error) {
      return {
        configured: true,
        reachable: false,
        bucket: PUBLICATION_MEDIA_BUCKET,
        latencyMs,
        error: error.message,
      };
    }
    return {
      configured: true,
      reachable: true,
      bucket: PUBLICATION_MEDIA_BUCKET,
      latencyMs,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      bucket: PUBLICATION_MEDIA_BUCKET,
      latencyMs: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function summarizeQueueStats(stats: QueueStats[]) {
  return stats.reduce(
    (acc, q) => ({
      active: acc.active + q.active,
      waiting: acc.waiting + q.waiting,
      failed: acc.failed + q.failed,
      delayed: acc.delayed + q.delayed,
    }),
    { active: 0, waiting: 0, failed: 0, delayed: 0 }
  );
}

export function deriveReadinessStatus(input: {
  databaseOk: boolean;
  redisConfigured: boolean;
  redisOk: boolean;
  storageOk: boolean;
  workerRequired: boolean;
  workerAlive: boolean;
}): HealthStatus {
  if (!input.databaseOk) return "unhealthy";
  if (input.redisConfigured && !input.redisOk) return "unhealthy";
  if (!input.storageOk) return "degraded";
  if (input.workerRequired && !input.workerAlive) return "degraded";
  return "healthy";
}

export function readinessHttpStatus(status: HealthStatus): number {
  if (status === "unhealthy") return 503;
  return 200;
}

export async function buildReadinessReport(
  supabase: SupabaseClient
): Promise<ReadinessReport> {
  const [database, redis, storage, workerHeartbeat, queueStats] =
    await Promise.all([
      checkDatabaseHealth(supabase),
      checkRedisHealth(),
      checkStorageHealth(supabase),
      readWorkerHeartbeat(),
      getAllCampaignPerformanceQueueStats(),
    ]);

  const redisConfigured = isRedisConfigured();
  const workerRequired = redisConfigured;
  const status = deriveReadinessStatus({
    databaseOk: database.connected,
    redisConfigured,
    redisOk: redis.connected,
    storageOk: storage.reachable,
    workerRequired,
    workerAlive: workerHeartbeat.alive,
  });

  const worker: WorkerHealth = {
    redisConfigured,
    heartbeatConfigured: workerHeartbeat.configured,
    alive: workerHeartbeat.alive,
    stale: workerHeartbeat.stale,
    ageMs: workerHeartbeat.ageMs,
    version: workerHeartbeat.payload?.version ?? null,
    gitSha: workerHeartbeat.payload?.gitSha ?? null,
    queues: workerHeartbeat.payload?.queues ?? [...DISCOVERY_WORKER_QUEUES],
    error: workerHeartbeat.error,
  };

  const controlSettings = await getDiscoveryControlSettings(supabase);
  const apifyCaps = resolveApifyBudgetCaps(controlSettings.costProtection);
  const budgetConfigured = areApifyBudgetCapsConfigured(apifyCaps);
  const tokenConfigured = Boolean(getMetricsCollectorEnv().apifyToken);
  const apify: ApifyReadiness = {
    tokenConfigured,
    maxRequestsPerDay: apifyCaps.maxRequestsPerDay,
    maxCreditsPerDay: apifyCaps.maxCreditsPerDay,
    budgetConfigured,
    liveAcquisitionAllowed: budgetConfigured && tokenConfigured,
  };

  return {
    status,
    environment: getThinkwayEnvironment(),
    timestamp: new Date().toISOString(),
    database,
    redis,
    storage,
    worker,
    apify,
    queues: {
      configured: redisConfigured,
      stats: queueStats,
      totals: summarizeQueueStats(queueStats),
    },
    build: getBuildInfo(),
  };
}

export type LivenessReport = {
  status: "ok";
  service: "thinkway-platform";
  environment: string;
  timestamp: string;
};

export function buildLivenessReport(): LivenessReport {
  return {
    status: "ok",
    service: "thinkway-platform",
    environment: getThinkwayEnvironment(),
    timestamp: new Date().toISOString(),
  };
}
