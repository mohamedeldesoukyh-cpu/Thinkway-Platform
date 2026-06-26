#!/usr/bin/env node
/**
 * Validate BullMQ queues for campaign performance infrastructure.
 * Run: npm run verify:production-queues
 */
import "@/lib/performance/script-env-preload";

import {
  CAMPAIGN_PERFORMANCE_QUEUES,
  checkRedisHealth,
  getAllCampaignPerformanceQueueStats,
  isQueueStatsHealthy,
  QUEUE_WAITING_THRESHOLD,
} from "@/lib/performance/campaign-performance-queues";
import { requireScriptEnvVars } from "@/lib/performance/script-env";

type CheckResult = { ok: boolean; label: string; detail?: string };
const checks: CheckResult[] = [];

function pass(label: string, detail = "") {
  checks.push({ ok: true, label, detail });
  console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail = "") {
  checks.push({ ok: false, label, detail });
  console.log(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  requireScriptEnvVars(["REDIS_URL"]);

  console.log("\n=== Campaign Performance — Production Queue Verification ===\n");
  console.log(`Queues: ${Object.values(CAMPAIGN_PERFORMANCE_QUEUES).join(", ")}\n`);

  const redis = await checkRedisHealth();
  if (redis.connected) {
    pass("Redis connectivity", `latency=${redis.latencyMs}ms`);
  } else {
    fail("Redis connectivity", redis.error ?? "not connected");
  }

  const stats = await getAllCampaignPerformanceQueueStats();

  for (const q of stats) {
    const summary = `active=${q.active} waiting=${q.waiting} delayed=${q.delayed} failed=${q.failed}`;
    if (!q.available) {
      fail(`Queue ${q.name}`, q.error ?? "unavailable");
      continue;
    }
    if (q.failed > 0) {
      fail(`Queue ${q.name}`, `${summary} — failed jobs must be 0`);
    } else if (q.waiting > QUEUE_WAITING_THRESHOLD) {
      fail(`Queue ${q.name}`, `${summary} — waiting exceeds ${QUEUE_WAITING_THRESHOLD}`);
    } else {
      pass(`Queue ${q.name}`, summary);
    }
  }

  const allHealthy = stats.every(isQueueStatsHealthy) && redis.connected;
  console.log(`\n=== Summary: ${allHealthy ? "PASS" : "FAIL"} ===\n`);

  if (!allHealthy) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
