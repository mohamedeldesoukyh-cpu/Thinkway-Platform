import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAlerts } from "./engine";
import type { HealthCheckResult, QueueMonitorRow } from "../types";

function component(
  partial: Partial<HealthCheckResult> & Pick<HealthCheckResult, "id" | "status">,
): HealthCheckResult {
  return {
    name: partial.id,
    kind: "infrastructure",
    latencyMs: null,
    checkedAt: new Date().toISOString(),
    score: 0,
    ...partial,
  };
}

test("evaluateAlerts fires on Redis offline", () => {
  const alerts = evaluateAlerts({
    components: [component({ id: "redis", status: "offline", message: "down" })],
    queues: [],
    workerAlive: true,
    workerStale: false,
    overallHealthScore: 80,
    runtimeMode: "production",
  });
  assert.ok(alerts.some((a) => a.id === "redis-offline"));
  assert.equal(alerts.find((a) => a.id === "redis-offline")?.level, "critical");
});

test("evaluateAlerts fires on stuck queues and stale worker in production", () => {
  const queues: QueueMonitorRow[] = [
    {
      name: "discovery-run",
      waiting: 500,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      retries: 0,
      deadLetter: 2,
      available: true,
      oldestWaitingAgeMs: 60 * 60_000,
      longestRunningAgeMs: null,
      throughputHint: "",
    },
  ];
  const alerts = evaluateAlerts({
    components: [],
    queues,
    workerAlive: false,
    workerStale: true,
    overallHealthScore: 40,
    runtimeMode: "production",
  });
  assert.ok(alerts.some((a) => a.id === "queue-stuck"));
  assert.ok(alerts.some((a) => a.id === "worker-crashed"));
  assert.ok(alerts.some((a) => a.id === "error-spike"));
});

test("evaluateAlerts treats missing local worker as info, not critical", () => {
  const alerts = evaluateAlerts({
    components: [
      component({ id: "vercel", status: "expected", message: "local" }),
    ],
    queues: [],
    workerAlive: false,
    workerStale: false,
    overallHealthScore: 40,
    runtimeMode: "local",
  });
  assert.ok(alerts.some((a) => a.id === "worker-local-expected"));
  assert.equal(
    alerts.find((a) => a.id === "worker-local-expected")?.level,
    "info",
  );
  assert.ok(!alerts.some((a) => a.id === "worker-crashed"));
  assert.ok(!alerts.some((a) => a.id === "error-spike"));
  assert.ok(alerts.some((a) => a.id === "vercel-local-expected"));
});
