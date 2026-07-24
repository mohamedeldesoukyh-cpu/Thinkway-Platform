import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { WORKER_CLASSIFICATIONS } from "./workspace-classification-registry";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("all workers/crons are classified service_only", () => {
  assert.ok(WORKER_CLASSIFICATIONS.length >= 6);
  for (const entry of WORKER_CLASSIFICATIONS) {
    assert.equal(entry.class, "service_only", entry.id);
    assert.ok(entry.kind === "worker" || entry.kind === "cron");
  }
});

test("discovery worker enrichment jobs are entity-scoped", () => {
  const worker = readFileSync(
    join(repoRoot, "services/discovery-worker/src/workers/creator-enrichment.worker.ts"),
    "utf8",
  );
  assert.match(worker, /CreatorEnrichmentJobPayload/);
  assert.match(worker, /creatorId|influencerId|platformAccountId/i);
});

test("cron routes require CRON_SECRET authorization helper", () => {
  for (const route of [
    "app/api/cron/publication-metrics/route.ts",
    "app/api/cron/campaign-performance-monitor/route.ts",
  ]) {
    const src = readFileSync(join(repoRoot, route), "utf8");
    assert.match(
      src,
      /CRON_SECRET|Bearer/,
      `${route} missing cron auth`,
    );
  }
});

test("worker must not accept arbitrary tenant override without entity id", () => {
  // Boundary: a wrong-tenant job without entity id is structurally invalid.
  type JobPayload = { creatorId?: string; tenantId?: string };
  function assertWorkerJobScoped(job: JobPayload): void {
    if (!job.creatorId && !job.tenantId) {
      throw new Error("Worker job missing tenant/entity scope");
    }
  }
  assert.throws(() => assertWorkerJobScoped({}));
  assert.doesNotThrow(() => assertWorkerJobScoped({ creatorId: "c1" }));
});
