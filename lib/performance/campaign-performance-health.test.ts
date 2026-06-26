import assert from "node:assert/strict";

import {
  buildAuditVerdict,
  type CampaignPerformanceExtendedAudit,
} from "@/lib/performance/campaign-performance-audit";
import {
  buildCampaignPerformanceHealthWarnings,
  buildHistoricalFailedJobsSummary,
  deriveCampaignPerformanceHealthStatus,
  healthHttpStatus,
  type CampaignPerformanceHealthResponse,
} from "@/lib/performance/campaign-performance-health";
import {
  isQueueStatsHealthy,
  type QueueFailureBreakdown,
  type QueueStats,
} from "@/lib/performance/campaign-performance-queues";

const baseQueueStats: QueueStats = {
  name: "publication-metrics",
  active: 0,
  waiting: 5,
  delayed: 0,
  failed: 0,
  completed: 100,
  paused: 0,
  available: true,
};

const baseExtended: CampaignPerformanceExtendedAudit = {
  scannedAt: new Date().toISOString(),
  totalPublications: 100,
  missingAvatarsCount: 0,
  missingPreviewScreenshotsCount: 0,
  missingMetricsCount: 0,
  platformMismatchesCount: 0,
  recoverableMetricsCount: 0,
  findings: [],
  totalCampaigns: 10,
  campaignsWithPublications: 8,
  publicationsMissingMetrics: 0,
  publicationsMissingScreenshots: 0,
  creatorsMissingAvatars: 0,
  staleMetricsCount: 0,
  failedSyncJobsCount: 0,
  queueBacklog: 0,
  orphanMetricsRows: 0,
  orphanScreenshots: 0,
  reportGenerationFailures: 0,
  queueStats: [baseQueueStats],
};

const healthyInputs = {
  databaseOk: true,
  redisOk: true,
  workersReachable: true,
  backlogOk: true,
  recentFailedJobsTotal: 0,
  historicalFailedJobsTotal: 0,
  criticalAuditIssues: 0,
  reportFailures: 0,
};

{
  const verdict = buildAuditVerdict(baseExtended);
  assert.equal(verdict.verdict, "PASS");
  assert.equal(verdict.failReasons.length, 0);
}

{
  const verdict = buildAuditVerdict({
    ...baseExtended,
    missingMetricsCount: 5,
    publicationsMissingMetrics: 5,
  });
  assert.equal(verdict.verdict, "WARN");
  assert.ok(verdict.warnReasons.some((r) => r.includes("missing metrics")));
}

{
  const verdict = buildAuditVerdict({
    ...baseExtended,
    recoverableMetricsCount: 2,
    queueStats: [
      {
        ...baseQueueStats,
        failed: 3,
      },
    ],
  });
  assert.equal(verdict.verdict, "FAIL");
  assert.ok(verdict.failReasons.length >= 2);
}

{
  assert.equal(isQueueStatsHealthy({ ...baseQueueStats, failed: 3 }), true);
  assert.equal(isQueueStatsHealthy({ ...baseQueueStats, waiting: 1001 }), false);
  assert.equal(isQueueStatsHealthy(baseQueueStats), true);
}

{
  assert.equal(healthHttpStatus("healthy"), 200);
  assert.equal(healthHttpStatus("degraded"), 200);
  assert.equal(healthHttpStatus("unhealthy"), 503);
}

{
  assert.equal(
    deriveCampaignPerformanceHealthStatus({
      ...healthyInputs,
      historicalFailedJobsTotal: 12,
    }),
    "degraded"
  );
}

{
  assert.equal(
    deriveCampaignPerformanceHealthStatus({
      ...healthyInputs,
      recentFailedJobsTotal: 2,
    }),
    "unhealthy"
  );
}

{
  assert.equal(deriveCampaignPerformanceHealthStatus(healthyInputs), "healthy");
}

{
  const breakdowns: QueueFailureBreakdown[] = [
    {
      name: "publication-metrics",
      totalFailed: 5,
      recentFailed: 0,
      historicalFailed: 5,
      available: true,
    },
    {
      name: "publication-screenshot",
      totalFailed: 2,
      recentFailed: 1,
      historicalFailed: 1,
      available: true,
    },
  ];

  const historical = buildHistoricalFailedJobsSummary(breakdowns);
  assert.equal(historical.total, 7);
  assert.equal(historical.recent, 1);
  assert.equal(historical.historical, 6);
  assert.equal(historical.byQueue["publication-metrics"]?.historical, 5);

  const warnings = buildCampaignPerformanceHealthWarnings({
    queueStats: [
      baseQueueStats,
      { ...baseQueueStats, name: "publication-screenshot", waiting: 12 },
    ],
    failureBreakdowns: breakdowns,
  });
  assert.equal(warnings.historicalFailedJobs, 6);
  assert.equal(warnings.queueWarnings["publication-metrics"]?.historicalFailed, 5);
  assert.equal(warnings.queueWarnings["publication-screenshot"]?.recentFailed, 1);
}

{
  const shape: CampaignPerformanceHealthResponse = {
    status: "healthy",
    warnings: {
      historicalFailedJobs: 0,
      elevatedBacklog: false,
      queueWarnings: {},
    },
    historicalFailedJobs: {
      total: 0,
      recent: 0,
      historical: 0,
      byQueue: {},
    },
    database: { connected: true, latencyMs: 12 },
    redis: { connected: true, latencyMs: 3, urlConfigured: true },
    queues: {},
    workers: {
      discoveryWorkerExpected: true,
      metricsWorkerExpected: true,
      screenshotWorkerExpected: true,
      queuesReachable: true,
      notes: [],
    },
    metricsProviders: {
      apify: true,
      metaGraph: false,
      youtube: false,
      playwright: false,
    },
    screenshots: { bucketConfigured: true, missingCount: 0, orphanReferences: 0 },
    reports: { sampleSize: 25, failures: 0, healthy: true },
    cron: {
      monitorConfigured: true,
      metricsCronConfigured: true,
      lastPublicationSync: null,
    },
    audit: {
      totalPublications: 0,
      missingMetricsCount: 0,
      missingPreviewScreenshotsCount: 0,
      recoverableMetricsCount: 0,
      staleMetricsCount: 0,
      failedSyncJobsCount: 0,
      queueBacklog: 0,
    },
    timestamp: new Date().toISOString(),
  };
  assert.equal(shape.status, "healthy");
  assert.ok("database" in shape && "redis" in shape && "warnings" in shape);
}

console.log("campaign-performance-health tests passed");
