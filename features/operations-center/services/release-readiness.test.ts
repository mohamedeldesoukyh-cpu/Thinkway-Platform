import assert from "node:assert/strict";
import test from "node:test";

import { evaluateReleaseReadiness } from "./release-readiness";
import type { HealthCheckResult, WorkerHealthSummary } from "../types";

function component(
  id: string,
  status: HealthCheckResult["status"],
  message?: string,
): HealthCheckResult {
  return {
    id,
    name: id,
    kind: "infrastructure",
    status,
    latencyMs: status === "healthy" ? 12 : null,
    checkedAt: new Date().toISOString(),
    score: status === "healthy" || status === "expected" ? 100 : 0,
    message,
  };
}

function worker(alive: boolean): WorkerHealthSummary {
  return {
    alive,
    stale: false,
    ageMs: alive ? 1000 : null,
    version: alive ? "1.0.0" : null,
    lastHeartbeat: alive ? new Date().toISOString() : null,
    lastCompletedJob: null,
    lastFailedJob: null,
    uptimeMs: alive ? 60_000 : null,
    queues: [],
    status: alive ? "healthy" : "expected",
    reason: alive ? "ok" : "not running",
    suggestedAction: "npm run discovery:worker:dev",
    expectation: "optional_local",
    expectedProcesses: [],
    runningProcesses: alive ? ["discovery-worker"] : [],
    missingProcesses: alive ? [] : ["discovery-worker"],
  };
}

test("local missing worker is expected_local and does not block alone", () => {
  const prev = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    REDIS_URL: process.env.REDIS_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  };

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.CRON_SECRET = "cron";
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
  process.env.OPENAI_API_KEY = "sk-test";

  try {
    const result = evaluateReleaseReadiness({
      runtimeMode: "local",
      worker: worker(false),
      components: [
        component("supabase", "healthy"),
        component("redis", "healthy"),
        component("bullmq", "healthy"),
        component("storage", "healthy"),
      ],
    });

    const workerCheck = result.checks.find((c) => c.id === "discovery-worker");
    assert.equal(workerCheck?.status, "expected_local");
    assert.equal(workerCheck?.blocksRelease, false);
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("production missing worker blocks release", () => {
  const result = evaluateReleaseReadiness({
    runtimeMode: "production",
    worker: worker(false),
    components: [
      component("supabase", "healthy"),
      component("redis", "healthy"),
      component("bullmq", "healthy"),
      component("storage", "healthy"),
    ],
  });
  const workerCheck = result.checks.find((c) => c.id === "discovery-worker");
  assert.equal(workerCheck?.status, "fail");
  assert.equal(workerCheck?.blocksRelease, true);
  assert.equal(result.readyForProduction, false);
});
