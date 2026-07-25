import type { SupabaseClient } from "@supabase/supabase-js";

import { readWorkerHeartbeat } from "@/lib/observability/worker-heartbeat";

import { evaluateAlerts } from "../alerts/engine";
import { buildDependencyGraph } from "../dependency-graph/build-graph";
import {
  collectApiDomainMetrics,
  collectAuthMetrics,
  collectDiscoveryMetrics,
  collectFinanceMetrics,
  collectSecurityDomainMetrics,
  collectStorageDomainMetrics,
} from "../domains/collect-domain-metrics";
import {
  DISCOVERY_WORKER_PROCESS,
  expectedWorkerProcesses,
  getOpsRuntimeMode,
  localExpectationMessage,
} from "../environment/runtime-context";
import { runHealthEngine } from "../health/engine";
import { suggestedActionForStatus } from "../health/diagnostics";
import { queryOpsLogs, writeOpsLog } from "../logs/ops-log-buffer";
import {
  collectQueueMonitorRows,
  summarizeQueueTotals,
} from "../queues/monitor";
import type { OperationsCenterSnapshot, WorkerHealthSummary } from "../types";
import { collectDeploymentInformation } from "./deployment-info";
import { evaluateReleaseReadiness } from "./release-readiness";

function buildWorkerSummary(
  worker: Awaited<ReturnType<typeof readWorkerHeartbeat>>,
  runtimeMode: "local" | "production",
): WorkerHealthSummary {
  const local = runtimeMode === "local";
  const expected = expectedWorkerProcesses(runtimeMode);
  const running = worker.alive;
  const expectedProcesses = expected.map((p) => ({
    ...p,
    running: p.id === DISCOVERY_WORKER_PROCESS.id ? running : false,
  }));
  const runningProcesses = expectedProcesses
    .filter((p) => p.running)
    .map((p) => p.id);
  const missingProcesses = expectedProcesses
    .filter((p) => !p.running)
    .map((p) => p.id);

  const startCommand =
    local
      ? DISCOVERY_WORKER_PROCESS.startCommandLocal
      : DISCOVERY_WORKER_PROCESS.startCommandProduction;

  let status: WorkerHealthSummary["status"];
  let reason: string;
  let suggestedAction: string;

  if (!worker.configured) {
    if (local) {
      status = "expected";
      reason = localExpectationMessage(
        "Redis is not configured locally — worker heartbeat cannot be read.",
      );
      suggestedAction =
        "Set REDIS_URL=redis://127.0.0.1:6379, start Redis, then run npm run discovery:worker:dev";
    } else {
      status = "offline";
      reason = "REDIS_URL not configured — worker heartbeat cannot be read.";
      suggestedAction = suggestedActionForStatus(status, "discovery-worker");
    }
  } else if (worker.error) {
    status = "warning";
    reason = `Heartbeat read failed: ${worker.error}`;
    suggestedAction = "Verify Redis connectivity and REDIS_URL for this process.";
  } else if (!worker.alive) {
    if (local) {
      status = "expected";
      reason = localExpectationMessage(
        "Discovery worker is not running locally.",
      );
      suggestedAction = `Optional for local UI work. To process discovery jobs: ${startCommand}`;
    } else {
      status = "offline";
      reason = "No recent discovery-worker heartbeat in Redis.";
      suggestedAction = `Start the worker: ${startCommand}`;
    }
  } else if (worker.stale) {
    status = "warning";
    reason = "Worker heartbeat is stale (>90s).";
    suggestedAction = `Restart the worker: ${startCommand}`;
  } else {
    status = "healthy";
    reason = "Worker heartbeat is fresh.";
    suggestedAction = "No action required.";
  }

  const startedAt = worker.payload?.startedAt
    ? Date.parse(worker.payload.startedAt)
    : null;
  const uptimeMs =
    startedAt != null && Number.isFinite(startedAt)
      ? Math.max(0, Date.now() - startedAt)
      : null;

  return {
    alive: worker.alive,
    stale: worker.stale,
    ageMs: worker.ageMs,
    error: worker.error,
    version: worker.payload?.version ?? null,
    lastHeartbeat: worker.payload?.lastBeat ?? null,
    lastCompletedJob: null,
    lastFailedJob: null,
    uptimeMs,
    queues: worker.payload?.queues ?? [],
    status,
    reason,
    suggestedAction,
    expectation: local ? "optional_local" : "required",
    expectedProcesses,
    runningProcesses,
    missingProcesses,
  };
}

export async function buildOperationsCenterSnapshot(
  supabase: SupabaseClient,
): Promise<OperationsCenterSnapshot> {
  const runtimeMode = getOpsRuntimeMode();

  const [health, queues, workerRaw] = await Promise.all([
    runHealthEngine({ supabase }),
    collectQueueMonitorRows(),
    readWorkerHeartbeat(),
  ]);

  const worker = buildWorkerSummary(workerRaw, runtimeMode);
  const workerCount = worker.alive ? 1 : 0;

  const [auth, discovery, finance] = await Promise.all([
    collectAuthMetrics(supabase),
    collectDiscoveryMetrics(supabase, queues),
    collectFinanceMetrics(supabase, queues),
  ]);

  const storageComponent = health.components.find((c) => c.id === "storage");
  const nextJs = health.components.find((c) => c.id === "nextjs");

  const alerts = evaluateAlerts({
    components: health.components,
    queues,
    workerAlive: worker.alive,
    workerStale: worker.stale,
    overallHealthScore: health.overallHealthScore,
    runtimeMode,
  });

  const releaseReadiness = evaluateReleaseReadiness({
    components: health.components,
    worker,
    runtimeMode,
  });

  writeOpsLog({
    severity: health.overallStatus === "healthy" ? "info" : "warn",
    category: "operations",
    source: "operations-center",
    message: `Health snapshot score=${health.overallHealthScore} status=${health.overallStatus} mode=${runtimeMode}`,
    fields: { alerts: alerts.length, ready: releaseReadiness.readyForProduction },
  });

  return {
    generatedAt: new Date().toISOString(),
    health,
    deployment: collectDeploymentInformation(),
    releaseReadiness,
    runtimeMode,
    queues,
    queueTotals: summarizeQueueTotals(queues, workerCount),
    alerts,
    dependencyGraph: buildDependencyGraph(health.components),
    logs: queryOpsLogs({ limit: 50 }),
    domains: {
      infrastructure: health.components.filter(
        (c) =>
          c.kind === "infrastructure" ||
          c.kind === "queue" ||
          c.kind === "storage",
      ),
      ai: health.components.filter((c) => c.kind === "ai"),
      integrations: health.components.filter((c) => c.kind === "integration"),
      auth,
      discovery,
      finance,
      storage: collectStorageDomainMetrics(storageComponent),
      security: collectSecurityDomainMetrics(),
      api: collectApiDomainMetrics(nextJs),
    },
    worker,
  };
}
