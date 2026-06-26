import type { SupabaseClient } from "@supabase/supabase-js";

import {
  runCampaignPerformanceExtendedAudit,
  type CampaignPerformanceExtendedAudit,
} from "@/lib/performance/campaign-performance-audit";
import {
  checkRedisHealth,
  getAllCampaignPerformanceQueueStats,
  getAllQueueFailureBreakdowns,
  isQueueBacklogHealthy,
  QUEUE_WAITING_THRESHOLD,
  type QueueFailureBreakdown,
  type QueueStats,
  type RedisHealth,
} from "@/lib/performance/campaign-performance-queues";
import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type CampaignPerformanceHealthWarnings = {
  historicalFailedJobs: number;
  elevatedBacklog: boolean;
  queueWarnings: Record<
    string,
    {
      historicalFailed: number;
      recentFailed: number;
      waiting: number;
      elevatedBacklog: boolean;
    }
  >;
};

export type CampaignPerformanceHistoricalFailedJobs = {
  total: number;
  recent: number;
  historical: number;
  byQueue: Record<
    string,
    {
      total: number;
      recent: number;
      historical: number;
    }
  >;
};

export type CampaignPerformanceHealthResponse = {
  status: HealthStatus;
  warnings: CampaignPerformanceHealthWarnings;
  historicalFailedJobs: CampaignPerformanceHistoricalFailedJobs;
  database: {
    connected: boolean;
    latencyMs: number | null;
    error?: string;
  };
  redis: RedisHealth;
  queues: Record<
    string,
    Omit<QueueStats, "name"> & {
      healthy: boolean;
      recentFailed: number;
      historicalFailed: number;
    }
  >;
  workers: {
    discoveryWorkerExpected: boolean;
    metricsWorkerExpected: boolean;
    screenshotWorkerExpected: boolean;
    queuesReachable: boolean;
    notes: string[];
  };
  metricsProviders: {
    apify: boolean;
    metaGraph: boolean;
    youtube: boolean;
    playwright: boolean;
  };
  screenshots: {
    bucketConfigured: boolean;
    missingCount: number;
    orphanReferences: number;
  };
  reports: {
    sampleSize: number;
    failures: number;
    healthy: boolean;
  };
  cron: {
    monitorConfigured: boolean;
    metricsCronConfigured: boolean;
    lastPublicationSync: string | null;
  };
  audit: Pick<
    CampaignPerformanceExtendedAudit,
    | "totalPublications"
    | "missingMetricsCount"
    | "missingPreviewScreenshotsCount"
    | "recoverableMetricsCount"
    | "staleMetricsCount"
    | "failedSyncJobsCount"
    | "queueBacklog"
  >;
  timestamp: string;
};

export type CampaignPerformanceHealthInputs = {
  databaseOk: boolean;
  redisOk: boolean;
  workersReachable: boolean;
  backlogOk: boolean;
  recentFailedJobsTotal: number;
  historicalFailedJobsTotal: number;
  criticalAuditIssues: number;
  reportFailures: number;
};

async function checkDatabaseHealth(
  supabase: SupabaseClient
): Promise<{ connected: boolean; latencyMs: number | null; error?: string }> {
  const started = performance.now();
  try {
    const { error } = await supabase.from("campaign_publications").select("id").limit(1);
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

export function buildHistoricalFailedJobsSummary(
  breakdowns: QueueFailureBreakdown[]
): CampaignPerformanceHistoricalFailedJobs {
  const byQueue: CampaignPerformanceHistoricalFailedJobs["byQueue"] = {};
  let total = 0;
  let recent = 0;
  let historical = 0;

  for (const breakdown of breakdowns) {
    byQueue[breakdown.name] = {
      total: breakdown.totalFailed,
      recent: breakdown.recentFailed,
      historical: breakdown.historicalFailed,
    };
    total += breakdown.totalFailed;
    recent += breakdown.recentFailed;
    historical += breakdown.historicalFailed;
  }

  return { total, recent, historical, byQueue };
}

export function buildCampaignPerformanceHealthWarnings(input: {
  queueStats: QueueStats[];
  failureBreakdowns: QueueFailureBreakdown[];
}): CampaignPerformanceHealthWarnings {
  const failureByQueue = new Map(input.failureBreakdowns.map((b) => [b.name, b]));
  const queueWarnings: CampaignPerformanceHealthWarnings["queueWarnings"] = {};
  let historicalFailedJobs = 0;

  for (const queue of input.queueStats) {
    const failures = failureByQueue.get(queue.name);
    const queueHistoricalFailed = failures?.historicalFailed ?? 0;
    const queueRecentFailed = failures?.recentFailed ?? 0;
    const elevatedBacklog = queue.waiting > QUEUE_WAITING_THRESHOLD;

    if (queueHistoricalFailed > 0 || queueRecentFailed > 0 || elevatedBacklog) {
      queueWarnings[queue.name] = {
        historicalFailed: queueHistoricalFailed,
        recentFailed: queueRecentFailed,
        waiting: queue.waiting,
        elevatedBacklog,
      };
    }

    historicalFailedJobs += queueHistoricalFailed;
  }

  return {
    historicalFailedJobs,
    elevatedBacklog: input.queueStats.some((q) => q.waiting > QUEUE_WAITING_THRESHOLD),
    queueWarnings,
  };
}

export function deriveCampaignPerformanceHealthStatus(
  input: CampaignPerformanceHealthInputs
): HealthStatus {
  if (!input.databaseOk) return "unhealthy";
  if (!input.redisOk) return "unhealthy";
  if (!input.workersReachable) return "unhealthy";
  if (!input.backlogOk) return "unhealthy";
  if (input.recentFailedJobsTotal > 0) return "unhealthy";
  if (input.criticalAuditIssues > 0 || input.reportFailures > 0) return "unhealthy";
  if (input.historicalFailedJobsTotal > 0) return "degraded";
  return "healthy";
}

export async function buildCampaignPerformanceHealth(
  supabase: SupabaseClient
): Promise<CampaignPerformanceHealthResponse> {
  const [database, redis, queueStats, failureBreakdowns, audit] = await Promise.all([
    checkDatabaseHealth(supabase),
    checkRedisHealth(),
    getAllCampaignPerformanceQueueStats(),
    getAllQueueFailureBreakdowns(),
    runCampaignPerformanceExtendedAudit(supabase),
  ]);

  const screenshotEnv = getScreenshotCaptureEnv();
  const backlogOk = isQueueBacklogHealthy(queueStats);
  const historicalFailedJobs = buildHistoricalFailedJobsSummary(failureBreakdowns);
  const warnings = buildCampaignPerformanceHealthWarnings({ queueStats, failureBreakdowns });
  const failureByQueue = new Map(failureBreakdowns.map((b) => [b.name, b]));
  const queuesRecord: CampaignPerformanceHealthResponse["queues"] = {};

  for (const q of queueStats) {
    const failures = failureByQueue.get(q.name);
    const recentFailed = failures?.recentFailed ?? 0;
    const historicalFailed = failures?.historicalFailed ?? 0;

    queuesRecord[q.name] = {
      active: q.active,
      waiting: q.waiting,
      delayed: q.delayed,
      failed: q.failed,
      completed: q.completed,
      paused: q.paused,
      available: q.available,
      error: q.error,
      recentFailed,
      historicalFailed,
      healthy:
        q.available && q.waiting <= QUEUE_WAITING_THRESHOLD && recentFailed === 0,
    };
  }

  const workersReachable =
    redis.connected && queueStats.every((q) => q.available || q.waiting === 0);

  const criticalAuditIssues =
    audit.recoverableMetricsCount + audit.failedSyncJobsCount + audit.orphanMetricsRows;

  const status = deriveCampaignPerformanceHealthStatus({
    databaseOk: database.connected,
    redisOk: redis.connected,
    workersReachable,
    backlogOk,
    recentFailedJobsTotal: historicalFailedJobs.recent,
    historicalFailedJobsTotal: historicalFailedJobs.historical,
    criticalAuditIssues,
    reportFailures: audit.reportGenerationFailures,
  });

  const { data: lastSync } = await supabase
    .from("campaign_publications")
    .select("last_synced_at")
    .not("last_synced_at", "is", null)
    .order("last_synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workerNotes: string[] = [];
  if (!redis.connected) workerNotes.push("Redis unreachable — workers cannot process jobs");
  if (!workersReachable) workerNotes.push("One or more queues are unreachable");
  if (queueStats.some((q) => q.waiting > 100)) {
    workerNotes.push("Elevated queue backlog detected");
  }
  if (historicalFailedJobs.historical > 0) {
    workerNotes.push(
      `${historicalFailedJobs.historical} historical failed job(s) older than 24h — run clean:campaign-performance-queues`
    );
  }
  if (historicalFailedJobs.recent > 0) {
    workerNotes.push(`${historicalFailedJobs.recent} failed job(s) in the last 24 hours`);
  }

  return {
    status,
    warnings,
    historicalFailedJobs,
    database,
    redis,
    queues: queuesRecord,
    workers: {
      discoveryWorkerExpected: true,
      metricsWorkerExpected: true,
      screenshotWorkerExpected: true,
      queuesReachable: workersReachable,
      notes: workerNotes,
    },
    metricsProviders: {
      apify: Boolean(screenshotEnv.apifyToken),
      metaGraph: Boolean(screenshotEnv.metaGraphAccessToken),
      youtube: Boolean(screenshotEnv.youtubeApiKey),
      playwright: screenshotEnv.playwrightEnabled,
    },
    screenshots: {
      bucketConfigured: true,
      missingCount: audit.missingPreviewScreenshotsCount,
      orphanReferences: audit.orphanScreenshots,
    },
    reports: {
      sampleSize: 25,
      failures: audit.reportGenerationFailures,
      healthy: audit.reportGenerationFailures === 0,
    },
    cron: {
      monitorConfigured: true,
      metricsCronConfigured: true,
      lastPublicationSync: lastSync?.last_synced_at ?? null,
    },
    audit: {
      totalPublications: audit.totalPublications,
      missingMetricsCount: audit.missingMetricsCount,
      missingPreviewScreenshotsCount: audit.missingPreviewScreenshotsCount,
      recoverableMetricsCount: audit.recoverableMetricsCount,
      staleMetricsCount: audit.staleMetricsCount,
      failedSyncJobsCount: audit.failedSyncJobsCount,
      queueBacklog: audit.queueBacklog,
    },
    timestamp: new Date().toISOString(),
  };
}

export function healthHttpStatus(status: HealthStatus): number {
  return status === "unhealthy" ? 503 : 200;
}
