import type { SupabaseClient } from "@supabase/supabase-js";

import { readWorkerHeartbeat } from "@/lib/observability/worker-heartbeat";

import { evaluateAlerts } from "../alerts/engine";
import { buildDependencyGraph } from "../dependency-graph/build-graph";
import {
  collectAuthMetrics,
  collectDiscoveryMetrics,
  collectFinanceMetrics,
  collectSecurityDomainMetrics,
  collectStorageDomainMetrics,
} from "../domains/collect-domain-metrics";
import { runHealthEngine } from "../health/engine";
import { queryOpsLogs, writeOpsLog } from "../logs/ops-log-buffer";
import {
  collectQueueMonitorRows,
  summarizeQueueTotals,
} from "../queues/monitor";
import type { OperationsCenterSnapshot } from "../types";

export async function buildOperationsCenterSnapshot(
  supabase: SupabaseClient,
): Promise<OperationsCenterSnapshot> {
  const [health, queues, worker] = await Promise.all([
    runHealthEngine({ supabase }),
    collectQueueMonitorRows(),
    readWorkerHeartbeat(),
  ]);

  const [
    auth,
    discovery,
    finance,
  ] = await Promise.all([
    collectAuthMetrics(supabase),
    collectDiscoveryMetrics(supabase, queues),
    collectFinanceMetrics(supabase),
  ]);

  const storageStatus =
    health.components.find((c) => c.id === "storage")?.status ?? "unknown";

  const alerts = evaluateAlerts({
    components: health.components,
    queues,
    workerAlive: worker.alive,
    workerStale: worker.stale,
    overallHealthScore: health.overallHealthScore,
  });

  writeOpsLog({
    severity: health.overallStatus === "healthy" ? "info" : "warn",
    category: "operations",
    source: "operations-center",
    message: `Health snapshot score=${health.overallHealthScore} status=${health.overallStatus}`,
    fields: { alerts: alerts.length },
  });

  return {
    generatedAt: new Date().toISOString(),
    health,
    queues,
    queueTotals: summarizeQueueTotals(queues),
    alerts,
    dependencyGraph: buildDependencyGraph(health.components),
    logs: queryOpsLogs({ limit: 50 }),
    domains: {
      infrastructure: health.components.filter(
        (c) => c.kind === "infrastructure" || c.kind === "queue" || c.kind === "storage",
      ),
      ai: health.components.filter((c) => c.kind === "ai"),
      integrations: health.components.filter((c) => c.kind === "integration"),
      auth,
      discovery,
      finance,
      storage: collectStorageDomainMetrics(storageStatus),
      security: collectSecurityDomainMetrics(),
    },
    worker: {
      alive: worker.alive,
      stale: worker.stale,
      ageMs: worker.ageMs,
      error: worker.error,
    },
  };
}
