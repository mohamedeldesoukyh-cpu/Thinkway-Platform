import type {
  AlertLevel,
  AlertRecord,
  HealthCheckResult,
  QueueMonitorRow,
} from "../types";
import { getOpsRuntimeMode, type OpsRuntimeMode } from "../environment/runtime-context";

export type AlertRuleContext = {
  components: HealthCheckResult[];
  queues: QueueMonitorRow[];
  workerAlive: boolean;
  workerStale: boolean;
  overallHealthScore: number;
  runtimeMode?: OpsRuntimeMode;
};

function alert(
  id: string,
  level: AlertLevel,
  title: string,
  message: string,
  source: string,
): AlertRecord {
  return {
    id,
    level,
    title,
    message,
    source,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Deterministic alert evaluation from the latest health + queue snapshot.
 * Local development downgrades expected gaps to info (not critical warnings).
 */
export function evaluateAlerts(ctx: AlertRuleContext): AlertRecord[] {
  const alerts: AlertRecord[] = [];
  const local = (ctx.runtimeMode ?? getOpsRuntimeMode()) === "local";

  const byId = new Map(ctx.components.map((c) => [c.id, c]));

  const redis = byId.get("redis");
  if (redis && redis.status === "expected" && local) {
    alerts.push(
      alert(
        "redis-local-expected",
        "info",
        "Expected in Local Development",
        "Redis is not configured locally.",
        "redis",
      ),
    );
  } else if (redis && (redis.status === "offline" || redis.status === "critical")) {
    alerts.push(
      alert(
        "redis-offline",
        "critical",
        "Redis offline",
        redis.message ?? "Redis is unreachable.",
        "redis",
      ),
    );
  }

  const supabase = byId.get("supabase");
  if (
    supabase &&
    (supabase.status === "offline" || supabase.status === "critical")
  ) {
    alerts.push(
      alert(
        "supabase-unavailable",
        "critical",
        "Supabase unavailable",
        supabase.message ?? "Database probe failed.",
        "supabase",
      ),
    );
  }

  const storage = byId.get("storage");
  if (storage && storage.status === "critical") {
    alerts.push(
      alert(
        "storage-critical",
        "critical",
        "Storage nearly unavailable",
        storage.message ?? "Storage probe failed.",
        "storage",
      ),
    );
  }

  const openai = byId.get("openai");
  if (openai && (openai.status === "critical" || openai.status === "offline")) {
    alerts.push(
      alert(
        "ai-unavailable",
        "critical",
        "AI unavailable",
        openai.message ?? "OpenAI provider unhealthy.",
        "openai",
      ),
    );
  }

  if (!ctx.workerAlive || ctx.workerStale) {
    if (local && !ctx.workerAlive) {
      alerts.push(
        alert(
          "worker-local-expected",
          "info",
          "Expected in Local Development",
          "Discovery worker is not running locally. Start with: npm run discovery:worker:dev",
          "workers",
        ),
      );
    } else if (local && ctx.workerStale) {
      alerts.push(
        alert(
          "worker-stale-local",
          "warning",
          "Worker heartbeat stale",
          "Discovery worker heartbeat is stale — process may have hung. Restart: npm run discovery:worker:dev",
          "workers",
        ),
      );
    } else {
      alerts.push(
        alert(
          "worker-crashed",
          ctx.workerAlive ? "warning" : "critical",
          "Worker crashed or stale",
          ctx.workerAlive
            ? "Discovery worker heartbeat is stale."
            : "Discovery worker heartbeat missing.",
          "workers",
        ),
      );
    }
  }

  const stuck = ctx.queues.filter(
    (q) => q.waiting > 200 || (q.oldestWaitingAgeMs ?? 0) > 30 * 60_000,
  );
  if (stuck.length > 0) {
    alerts.push(
      alert(
        "queue-stuck",
        "warning",
        "Queue stuck",
        `High backlog on: ${stuck.map((q) => q.name).join(", ")}`,
        "bullmq",
      ),
    );
  }

  const failing = ctx.queues.filter((q) => q.failed > 25 || q.deadLetter > 0);
  if (failing.length > 0) {
    alerts.push(
      alert(
        "queue-failures",
        "warning",
        "Queue failures elevated",
        failing.map((q) => `${q.name} failed=${q.failed} dlq=${q.deadLetter}`).join("; "),
        "bullmq",
      ),
    );
  }

  const highLatency = ctx.components.filter(
    (c) => c.latencyMs != null && c.latencyMs > 2000,
  );
  if (highLatency.length > 0) {
    alerts.push(
      alert(
        "high-latency",
        "warning",
        "High latency",
        highLatency.map((c) => `${c.name} ${c.latencyMs}ms`).join(", "),
        "health-engine",
      ),
    );
  }

  // Local overall score is often lower when optional infra is absent; only spike in production.
  if (ctx.overallHealthScore < 50 && !local) {
    alerts.push(
      alert(
        "error-spike",
        "critical",
        "Large error spike / low health score",
        `Overall health score is ${ctx.overallHealthScore}.`,
        "health-engine",
      ),
    );
  }

  const vercel = byId.get("vercel");
  if (vercel?.status === "expected" && local) {
    alerts.push(
      alert(
        "vercel-local-expected",
        "info",
        "Expected in Local Development",
        "Running locally — Vercel deployment metadata is not available.",
        "vercel",
      ),
    );
  } else if (vercel?.meta && vercel.meta.deploymentFailed === true) {
    alerts.push(
      alert(
        "deployment-failed",
        "critical",
        "Deployment failed",
        vercel.message ?? "Vercel deployment reported failure.",
        "vercel",
      ),
    );
  }

  const levelRank: Record<AlertLevel, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  return alerts.sort((a, b) => levelRank[a.level] - levelRank[b.level]);
}
