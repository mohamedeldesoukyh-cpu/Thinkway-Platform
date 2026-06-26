#!/usr/bin/env node
/**
 * End-to-end verification for the publication metrics collection pipeline.
 * Run: npm run verify:publication-metrics-pipeline
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Queue } from "bullmq";
import { config } from "dotenv";
import IORedis from "ioredis";
import { createClient } from "@supabase/supabase-js";

import {
  enqueuePublicationMetricsJob,
  isMetricsQueueAvailable,
  PUBLICATION_METRICS_QUEUE,
} from "@/lib/performance/metrics-collector/queue";
import { queuePublicationForMetrics } from "@/lib/performance/metrics-collector/persist";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const TRIGGERED_BY = "pipeline-verify";
const JOB_POLL_INTERVAL_MS = 2_000;
const JOB_TIMEOUT_MS = 120_000;

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

function warn(label: string, detail = "") {
  console.log(`WARN  ${label}${detail ? ` — ${detail}` : ""}`);
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function maskRedisUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ":***@");
}

function normalizeRedisEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port || "6379"}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

async function redisEndpointsShareInstance(a: string, b: string): Promise<boolean> {
  const probeKey = `tw:redis:probe:${Date.now()}`;
  const probeValue = `probe-${Math.random().toString(36).slice(2)}`;
  const connA = new IORedis(a, { maxRetriesPerRequest: 1, connectTimeout: 5_000 });
  const connB = new IORedis(b, { maxRetriesPerRequest: 1, connectTimeout: 5_000 });
  try {
    await connA.set(probeKey, probeValue, "EX", 30);
    const read = await connB.get(probeKey);
    return read === probeValue;
  } finally {
    await connA.del(probeKey).catch(() => {});
    connA.disconnect();
    connB.disconnect();
  }
}

function loadRootEnv(): void {
  if (existsSync(path.join(root, ".env.local"))) {
    config({ path: path.join(root, ".env.local") });
  }
  config({ path: path.join(root, ".env") });
}

type PublicationSnapshot = {
  id: string;
  campaign_header_id: string;
  content_url: string | null;
  platform: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  last_synced_at: string | null;
  metrics_refresh_status: string | null;
  metrics_collection_source: string | null;
  metrics_provider: string | null;
  metrics_refresh_attempted_at: string | null;
  updated_at: string | null;
};

type SyncLogRow = {
  id: string;
  status: string;
  provider: string;
  message: string | null;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  metrics_snapshot: Record<string, unknown> | null;
};

async function fetchPublication(
  supabase: ReturnType<typeof createClient>,
  publicationId: string
): Promise<PublicationSnapshot | null> {
  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, content_url, platform, views, likes, comments, shares, last_synced_at, metrics_refresh_status, metrics_collection_source, metrics_provider, metrics_refresh_attempted_at, updated_at"
    )
    .eq("id", publicationId)
    .maybeSingle();

  if (error) throw new Error(`campaign_publications query failed: ${error.message}`);
  return data as PublicationSnapshot | null;
}

async function fetchSyncLogsSince(
  supabase: ReturnType<typeof createClient>,
  publicationId: string,
  sinceIso: string
): Promise<SyncLogRow[]> {
  const { data, error } = await supabase
    .from("publication_metric_sync_logs")
    .select(
      "id, status, provider, message, created_at, completed_at, duration_ms, metrics_snapshot"
    )
    .eq("publication_id", publicationId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`publication_metric_sync_logs query failed: ${error.message}`);
  return (data ?? []) as SyncLogRow[];
}

async function waitForJob(
  redisUrl: string,
  jobId: string
): Promise<{ state: string; returnvalue?: unknown; failedReason?: string }> {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(PUBLICATION_METRICS_QUEUE, { connection });
  const deadline = Date.now() + JOB_TIMEOUT_MS;

  try {
    while (Date.now() < deadline) {
      const job = await queue.getJob(jobId);
      if (!job) {
        await sleep(JOB_POLL_INTERVAL_MS);
        continue;
      }

      const state = await job.getState();
      if (state === "completed") {
        return { state, returnvalue: job.returnvalue };
      }
      if (state === "failed") {
        return { state, failedReason: job.failedReason ?? "unknown" };
      }

      await sleep(JOB_POLL_INTERVAL_MS);
    }

    const job = await queue.getJob(jobId);
    const state = job ? await job.getState() : "missing";
    return { state: `timeout (${state})` };
  } finally {
    await queue.close();
    connection.disconnect();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  loadRootEnv();

  const rootEnvFile = parseEnvFile(path.join(root, ".env"));
  const rootLocalEnvFile = parseEnvFile(path.join(root, ".env.local"));
  const workerEnvFile = parseEnvFile(path.join(root, "services/discovery-worker/.env"));

  console.log("\n=== Publication Metrics Pipeline — End-to-End Verification ===\n");

  // 1) REDIS_URL in Next.js and discovery-worker contexts
  console.log("1) REDIS_URL configuration");
  const rootRedisFromFiles =
    rootLocalEnvFile.REDIS_URL ?? rootEnvFile.REDIS_URL ?? null;
  const workerRedisFromFile = workerEnvFile.REDIS_URL ?? null;
  const nextRedisRuntime = process.env.REDIS_URL?.trim() || null;

  if (rootRedisFromFiles) {
    pass("Next.js .env REDIS_URL", maskRedisUrl(rootRedisFromFiles));
  } else {
    fail("Next.js .env REDIS_URL", "not set in .env or .env.local");
  }

  if (nextRedisRuntime) {
    pass("Next.js runtime REDIS_URL (dotenv loaded)", maskRedisUrl(nextRedisRuntime));
  } else {
    fail("Next.js runtime REDIS_URL (dotenv loaded)", "process.env.REDIS_URL empty after load");
  }

  if (workerRedisFromFile) {
    pass("discovery-worker .env REDIS_URL", maskRedisUrl(workerRedisFromFile));
  } else {
    warn(
      "discovery-worker .env REDIS_URL",
      "not set — worker falls back to redis://127.0.0.1:6379"
    );
  }

  const redisUrl = nextRedisRuntime ?? workerRedisFromFile ?? "redis://127.0.0.1:6379";

  if (isMetricsQueueAvailable()) {
    pass("isMetricsQueueAvailable()", "queue producer can connect");
  } else {
    fail("isMetricsQueueAvailable()", "REDIS_URL not available to metrics-collector queue");
  }

  const redisHostAligned =
    nextRedisRuntime &&
    workerRedisFromFile &&
    normalizeRedisEndpoint(nextRedisRuntime) === normalizeRedisEndpoint(workerRedisFromFile);

  if (nextRedisRuntime && workerRedisFromFile) {
    if (redisHostAligned) {
      pass("REDIS_URL endpoint alignment", normalizeRedisEndpoint(nextRedisRuntime));
    } else {
      fail(
        "REDIS_URL endpoint alignment",
        `Next.js=${normalizeRedisEndpoint(nextRedisRuntime)} vs worker=${normalizeRedisEndpoint(workerRedisFromFile)} — must be the same Redis instance`
      );
    }
  }

  let redisInstancesMatch = false;
  if (nextRedisRuntime && workerRedisFromFile) {
    try {
      redisInstancesMatch = await redisEndpointsShareInstance(
        nextRedisRuntime,
        workerRedisFromFile
      );
      if (redisInstancesMatch) {
        pass("REDIS_URL instance probe", "Next.js and worker URLs reference the same Redis");
      } else {
        fail(
          "REDIS_URL instance probe",
          "URLs resolve to different Redis instances (e.g. localhost vs 127.0.0.1 on Windows)"
        );
      }
    } catch (e) {
      fail("REDIS_URL instance probe", e instanceof Error ? e.message : String(e));
    }
  }

  // 2) Redis connectivity + queue acceptance
  console.log("\n2) Redis and publication-metrics queue");
  let redisPingOk = false;
  try {
    const redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    redis.on("error", () => {});
    await redis.connect();
    redisPingOk = (await redis.ping()) === "PONG";
    redis.disconnect();
  } catch (e) {
    fail("Redis ping", e instanceof Error ? e.message : String(e));
  }
  if (redisPingOk) {
    pass("Redis ping", maskRedisUrl(redisUrl));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    fail("Supabase credentials", "NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    printSummary();
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 3) Find test publication
  console.log("\n3) Test publication selection");
  const { data: publication, error: pubError } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, content_url, platform, views, likes, comments, shares, last_synced_at, metrics_refresh_status, metrics_collection_source, metrics_provider, metrics_refresh_attempted_at, updated_at"
    )
    .not("content_url", "is", null)
    .neq("content_url", "")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pubError) {
    fail("Find campaign_publication with content_url", pubError.message);
    printSummary();
    process.exit(1);
  }

  if (!publication) {
    fail(
      "Find campaign_publication with content_url",
      "no rows — add a publication with content_url before running"
    );
    printSummary();
    process.exit(1);
  }

  const pub = publication as PublicationSnapshot;
  pass("Test publication found", `id=${pub.id}`);
  console.log(`      platform: ${pub.platform ?? "unknown"}`);
  console.log(`      content_url: ${pub.content_url}`);
  console.log(`      campaign_header_id: ${pub.campaign_header_id}`);

  const startedAt = new Date().toISOString();
  const before = await fetchPublication(supabase, pub.id);
  const logsBeforeCount = (
    await fetchSyncLogsSince(supabase, pub.id, startedAt)
  ).length;

  // 4) Enqueue job
  console.log("\n4) Enqueue metrics collection job");
  await queuePublicationForMetrics(supabase, {
    publicationId: pub.id,
    campaignHeaderId: pub.campaign_header_id,
  });

  const enqueueResult = await enqueuePublicationMetricsJob({
    publicationId: pub.id,
    campaignHeaderId: pub.campaign_header_id,
    triggeredBy: TRIGGERED_BY,
  });

  if (!enqueueResult.enqueued || !enqueueResult.jobId) {
    fail("enqueuePublicationMetricsJob", "job was not enqueued — check REDIS_URL");
    printSummary();
    process.exit(1);
  }

  pass("Queue accepted job", `jobId=${enqueueResult.jobId}, queue=${PUBLICATION_METRICS_QUEUE}`);

  // 5) Wait for worker processing
  console.log("\n5) discovery-worker job processing");
  console.log(`      polling job ${enqueueResult.jobId} (timeout ${JOB_TIMEOUT_MS / 1000}s)…`);

  const jobOutcome = await waitForJob(redisUrl, enqueueResult.jobId);
  if (jobOutcome.state === "completed") {
    pass("Worker processed job", `returnvalue=${JSON.stringify(jobOutcome.returnvalue)}`);
  } else if (jobOutcome.state === "failed") {
    const reason = jobOutcome.failedReason ?? "job failed";
    if (reason.includes("fetch failed")) {
      fail(
        "Worker processed job",
        `${reason} — discovery-worker may need NODE_OPTIONS=--use-system-ca (npm run discovery:worker:dev)`
      );
    } else {
      fail("Worker processed job", reason);
    }
    pass("Worker received job", `job reached failed state (worker consumed from queue)`);
  } else {
    fail(
      "Worker processed job",
      `state=${jobOutcome.state} — ensure discovery-worker is running (npm run discovery:worker:dev)`
    );
  }

  // 6) Verify campaign_publications updated
  console.log("\n6) campaign_publications metrics write-back");
  const after = await fetchPublication(supabase, pub.id);
  if (!after) {
    fail("Read publication after job", "row missing");
  } else {
    const metricsChanged =
      after.last_synced_at !== before?.last_synced_at ||
      after.metrics_refresh_status !== before?.metrics_refresh_status ||
      after.views !== before?.views ||
      after.likes !== before?.likes ||
      after.comments !== before?.comments ||
      after.shares !== before?.shares ||
      after.metrics_collection_source !== before?.metrics_collection_source;

    if (metricsChanged || after.metrics_refresh_attempted_at) {
      pass("Publication row updated", `status=${after.metrics_refresh_status}`);
    } else {
      fail(
        "Publication row updated",
        "no detectable change in metrics fields — worker may not have persisted"
      );
    }

    console.log("      before → after:");
    console.log(`        last_synced_at: ${before?.last_synced_at ?? "null"} → ${after.last_synced_at ?? "null"}`);
    console.log(`        metrics_refresh_status: ${before?.metrics_refresh_status ?? "null"} → ${after.metrics_refresh_status ?? "null"}`);
    console.log(`        metrics_collection_source: ${before?.metrics_collection_source ?? "null"} → ${after.metrics_collection_source ?? "null"}`);
    console.log(`        views/likes/comments/shares: ${formatMetrics(before)} → ${formatMetrics(after)}`);
  }

  // 7) Verify sync log entry
  console.log("\n7) publication_metric_sync_logs");
  const logsAfter = await fetchSyncLogsSince(supabase, pub.id, startedAt);
  const newLogs = logsAfter.length - logsBeforeCount;

  if (logsAfter.length > 0) {
    const latest = logsAfter[0];
    pass(
      "Sync log entry created",
      `id=${latest.id}, provider=${latest.provider}, status=${latest.status}`
    );
    console.log(`      message: ${latest.message ?? "(none)"}`);
    console.log(`      completed_at: ${latest.completed_at ?? "(pending)"}`);
    console.log(`      duration_ms: ${latest.duration_ms ?? "(n/a)"}`);
    if (latest.metrics_snapshot) {
      console.log(`      metrics_snapshot: ${JSON.stringify(latest.metrics_snapshot)}`);
    }
    if (newLogs > 1) {
      console.log(`      (${newLogs} new log rows for this run)`);
    }
  } else {
    fail(
      "Sync log entry created",
      "no rows since verification start — check worker logs and publication_metric_sync_logs table"
    );
  }

  // 8) Summary
  printSummary(logsAfter[0]?.id, after ?? undefined, enqueueResult.jobId);
}

function formatMetrics(row: PublicationSnapshot | null | undefined): string {
  if (!row) return "null";
  return `${row.views ?? "—"}/${row.likes ?? "—"}/${row.comments ?? "—"}/${row.shares ?? "—"}`;
}

function printSummary(
  syncLogId?: string,
  publication?: PublicationSnapshot,
  jobId?: string
): void {
  console.log("\n8) Verification summary");
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`      checks: ${passed} passed, ${failed} failed (${checks.length} total)`);
  if (jobId) console.log(`      jobId: ${jobId}`);
  if (syncLogId) console.log(`      syncLogId: ${syncLogId}`);
  if (publication) {
    console.log(
      `      final metrics: views=${publication.views ?? "null"}, likes=${publication.likes ?? "null"}, status=${publication.metrics_refresh_status ?? "null"}`
    );
  }
  console.log("\n=== Done ===\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nVerification aborted:", err instanceof Error ? err.message : err);
  process.exit(1);
});
