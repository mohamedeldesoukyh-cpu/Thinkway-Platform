import {
  checkRedisHealth,
  isRedisConfigured,
  getQueueStats,
} from "@/lib/performance/campaign-performance-queues";
import { PUBLICATION_MEDIA_BUCKET } from "@/lib/performance/screenshot-capture/config";
import { getBuildInfo } from "@/lib/deploy/build-info";
import { DISCOVERY_WORKER_QUEUES } from "@/lib/observability/discovery-queues";
import {
  parseRedisEndpoint,
  suggestedRedisLocalFix,
} from "@/lib/redis/parse-redis-url";

import type { HealthProvider } from "./types";
import { resultBase, scoreFromStatus } from "./types";
import {
  REDIS_LATENCY_THRESHOLDS,
  STORAGE_LATENCY_THRESHOLDS,
  SUPABASE_LATENCY_THRESHOLDS,
  latencyReason,
  withDiagnostics,
} from "../health/diagnostics";
import {
  isOpsLocalRuntime,
  localExpectationMessage,
} from "../environment/runtime-context";

export const nextJsProvider: HealthProvider = {
  id: "nextjs",
  name: "Next.js App",
  kind: "infrastructure",
  weight: 1.2,
  async check() {
    const started = performance.now();
    const build = getBuildInfo();
    const latencyMs = Math.round(performance.now() - started);
    const reason = `Application process is serving requests in ${build.environment}.`;
    return withDiagnostics(
      resultBase(this, {
        status: "healthy",
        latencyMs,
        message: `App process healthy · ${build.environment} · ${build.gitShaShort ?? "local"}`,
        lastSuccessAt: new Date().toISOString(),
        meta: { build },
      }),
      {
        reason,
        suggestedAction: "No action required.",
        technicalDetails: {
          environment: build.environment,
          gitSha: build.gitSha,
          gitBranch: build.gitBranch,
          buildTimestamp: build.builtAt,
        },
      },
    );
  },
};

export const vercelProvider: HealthProvider = {
  id: "vercel",
  name: "Vercel deployment",
  kind: "infrastructure",
  weight: 0.8,
  async check() {
    const build = getBuildInfo();
    const env = process.env.VERCEL_ENV?.trim() ?? null;
    const url = process.env.VERCEL_URL?.trim() ?? null;
    const token = process.env.VERCEL_API_TOKEN?.trim();
    const deploymentId = build.deploymentId;

    if (!env && !url && !deploymentId) {
      if (isOpsLocalRuntime()) {
        return withDiagnostics(
          resultBase(this, {
            status: "expected",
            latencyMs: null,
            message: localExpectationMessage(
              "Running locally — Vercel deployment metadata is not available.",
            ),
            score: scoreFromStatus("expected"),
            meta: { localExpected: true },
          }),
          {
            reason:
              "Running locally — Vercel deployment metadata is not available.",
            suggestedAction:
              "No action required for local development. VERCEL_* vars appear after a Vercel deploy.",
            technicalDetails: {
              vercelEnv: env,
              vercelUrl: url,
              runtimeMode: "local",
            },
          },
        );
      }

      return withDiagnostics(
        resultBase(this, {
          status: "unknown",
          latencyMs: null,
          message: "Not running on Vercel (or env metadata unavailable).",
        }),
        {
          reason: "Vercel deployment metadata is not present in this process.",
          suggestedAction:
            "Deploy via Vercel git integration so VERCEL_* system env vars are injected.",
          technicalDetails: { vercelEnv: env, vercelUrl: url },
        },
      );
    }

    if (!token) {
      return withDiagnostics(
        resultBase(this, {
          status: "healthy",
          latencyMs: null,
          message: `Deploy metadata present (${env ?? "unknown"}) — live Deploy API not queried.`,
          meta: { env, url, deploymentId },
          score: 85,
        }),
        {
          reason:
            "Vercel system metadata is available. Deploy API token is not configured, so live deployment status is inferred from env only.",
          suggestedAction:
            "Optional: set VERCEL_API_TOKEN to enable live deployment status checks.",
          technicalDetails: {
            vercelEnv: env,
            deploymentUrl: build.deploymentUrl,
            deploymentId,
            deploymentStatus: env ? `running (${env})` : "unknown",
          },
        },
      );
    }

    return withDiagnostics(
      resultBase(this, {
        status: "healthy",
        latencyMs: null,
        message: `Vercel ${env} · token configured.`,
        meta: { env, url, deploymentId },
      }),
      {
        reason: `Vercel environment ${env ?? "unknown"} with API token present.`,
        technicalDetails: {
          vercelEnv: env,
          deploymentUrl: build.deploymentUrl,
          deploymentId,
          deploymentStatus: env ? `running (${env})` : "unknown",
        },
      },
    );
  },
};

export const supabaseProvider: HealthProvider = {
  id: "supabase",
  name: "Supabase",
  kind: "infrastructure",
  weight: 1.5,
  async check(ctx) {
    const build = getBuildInfo();
    const projectRef = build.supabaseProjectRef;
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? null;
    const region = build.supabaseRegion;
    const thresholds = SUPABASE_LATENCY_THRESHOLDS;

    if (!ctx.supabase) {
      return withDiagnostics(
        resultBase(this, {
          status: "unknown",
          latencyMs: null,
          message: "Supabase client not provided.",
        }),
        {
          reason: "No Supabase client was passed to the health engine.",
          suggestedAction: "Ensure the Operations Center page creates a server Supabase client.",
          thresholds,
          technicalDetails: { projectRef, projectUrl, region },
        },
      );
    }

    const started = performance.now();
    try {
      const { error } = await ctx.supabase.from("profiles").select("id").limit(1);
      const latencyMs = Math.round(performance.now() - started);

      if (error) {
        return withDiagnostics(
          resultBase(this, {
            status: "critical",
            latencyMs,
            message: error.message,
            lastFailureAt: new Date().toISOString(),
            lastFailure: error.message,
          }),
          {
            reason: `Database reachable probe failed: ${error.message}`,
            suggestedAction:
              "Verify NEXT_PUBLIC_SUPABASE_URL, anon key, RLS policies for profiles, and project status in the Supabase dashboard.",
            thresholds,
            technicalDetails: {
              projectRef,
              projectUrl,
              region,
              databaseReachable: false,
              connectionLatencyMs: latencyMs,
              error: error.message,
              alignedWithExpected: build.supabaseAligned,
              expectedProjectRef: build.expectedSupabaseProjectRef,
            },
          },
        );
      }

      const { status, reason: latencyStatusReason } = latencyReason(
        latencyMs,
        thresholds,
      );
      const alignmentNote =
        build.supabaseAligned === false
          ? ` Connected project ${projectRef} does not match expected ${build.expectedSupabaseProjectRef}.`
          : "";
      const statusWithAlignment =
        build.supabaseAligned === false && status === "healthy"
          ? ("warning" as const)
          : status;
      const reason =
        build.supabaseAligned === false
          ? `Database reachable, but project ref mismatch.${alignmentNote}`
          : latencyStatusReason;

      return withDiagnostics(
        resultBase(this, {
          status: statusWithAlignment,
          latencyMs,
          message: `Project ${projectRef ?? "unknown"} · ${latencyMs} ms`,
          lastSuccessAt: new Date().toISOString(),
          score: scoreFromStatus(statusWithAlignment),
          meta: {
            projectRef,
            projectUrl,
            region,
            databaseReachable: true,
          },
        }),
        {
          reason,
          suggestedAction:
            statusWithAlignment === "healthy"
              ? "No action required."
              : build.supabaseAligned === false
                ? `Point this environment at expected Supabase project ${build.expectedSupabaseProjectRef}.`
                : "Check DB load, connection pooling, and region proximity.",
          thresholds,
          technicalDetails: {
            projectRef,
            projectUrl,
            region: region ?? "Set SUPABASE_REGION to display region",
            postgresVersion:
              process.env.SUPABASE_POSTGRES_VERSION?.trim() ??
              "Not exposed via PostgREST — set SUPABASE_POSTGRES_VERSION if needed",
            databaseReachable: true,
            connectionLatencyMs: latencyMs,
            alignedWithExpected: build.supabaseAligned,
            expectedProjectRef: build.expectedSupabaseProjectRef,
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return withDiagnostics(
        resultBase(this, {
          status: "offline",
          latencyMs: null,
          message,
          lastFailure: message,
          lastFailureAt: new Date().toISOString(),
        }),
        {
          reason: `Supabase probe threw: ${message}`,
          suggestedAction:
            "Confirm the project is online and network access to *.supabase.co is allowed.",
          thresholds,
          technicalDetails: {
            projectRef,
            projectUrl,
            region,
            databaseReachable: false,
            error: message,
          },
        },
      );
    }
  },
};

export const redisProvider: HealthProvider = {
  id: "redis",
  name: "Redis",
  kind: "infrastructure",
  weight: 1.3,
  async check() {
    const thresholds = REDIS_LATENCY_THRESHOLDS;
    const endpoint = parseRedisEndpoint();
    const local = isOpsLocalRuntime();

    if (!isRedisConfigured()) {
      if (local) {
        return withDiagnostics(
          resultBase(this, {
            status: "expected",
            latencyMs: null,
            message: localExpectationMessage("Redis is not configured locally."),
            score: scoreFromStatus("expected"),
            meta: { localExpected: true },
          }),
          {
            reason: "Redis is not configured locally.",
            suggestedAction: suggestedRedisLocalFix(endpoint),
            thresholds,
            technicalDetails: {
              ...endpoint,
              authenticationSucceeded: null,
              pingLatencyMs: null,
              healthy: `<${thresholds.warningMs} ms`,
              warning: `${thresholds.warningMs}–${thresholds.criticalMs} ms`,
              critical: `>${thresholds.criticalMs} ms`,
              suggestedFix: suggestedRedisLocalFix(endpoint),
            },
          },
        );
      }

      return withDiagnostics(
        resultBase(this, {
          status: "warning",
          latencyMs: null,
          message: "REDIS_URL not configured — queues/workers unavailable.",
          score: scoreFromStatus("warning"),
        }),
        {
          reason: "REDIS_URL is missing; Redis cannot be pinged.",
          suggestedAction:
            "Set REDIS_URL in the deployment environment to enable queues and workers.",
          thresholds,
          technicalDetails: {
            ...endpoint,
            authenticationSucceeded: null,
            pingLatencyMs: null,
            healthy: `<${thresholds.warningMs} ms`,
            warning: `${thresholds.warningMs}–${thresholds.criticalMs} ms`,
            critical: `>${thresholds.criticalMs} ms`,
          },
        },
      );
    }

    const health = await checkRedisHealth();
    if (!health.connected) {
      const fix = suggestedRedisLocalFix(endpoint);
      return withDiagnostics(
        resultBase(this, {
          status: "offline",
          latencyMs: health.latencyMs,
          message: health.error ?? "Redis unreachable",
          lastFailure: health.error ?? "Redis unreachable",
          lastFailureAt: new Date().toISOString(),
        }),
        {
          reason: health.error ?? "Redis PING failed.",
          suggestedAction: fix,
          thresholds,
          technicalDetails: {
            ...endpoint,
            connected: false,
            authenticationSucceeded: false,
            pingLatencyMs: health.latencyMs,
            currentLatencyMs: health.latencyMs,
            lastFailedPing: new Date().toISOString(),
            error: health.error,
            suggestedFix: fix,
            healthy: `<${thresholds.warningMs} ms`,
            warning: `${thresholds.warningMs}–${thresholds.criticalMs} ms`,
            critical: `>${thresholds.criticalMs} ms`,
          },
        },
      );
    }

    const { status, reason } = latencyReason(health.latencyMs, thresholds);
    const now = new Date().toISOString();
    return withDiagnostics(
      resultBase(this, {
        status,
        latencyMs: health.latencyMs,
        message:
          status === "healthy"
            ? `Redis PING ok · ${endpoint.host}:${endpoint.port} · ${health.latencyMs} ms`
            : `Redis PING ok but latency ${health.latencyMs} ms`,
        lastSuccessAt: now,
        score: scoreFromStatus(status),
      }),
      {
        reason,
        suggestedAction:
          status === "healthy"
            ? "No action required."
            : "Inspect Redis CPU/memory, network RTT to the Redis host, and concurrent worker load.",
        thresholds,
        technicalDetails: {
          ...endpoint,
          connected: true,
          authenticationSucceeded: true,
          pingLatencyMs: health.latencyMs,
          currentLatencyMs: health.latencyMs,
          lastSuccessfulPing: now,
          lastFailedPing: null,
          healthy: `<${thresholds.warningMs} ms`,
          warning: `${thresholds.warningMs}–${thresholds.criticalMs} ms`,
          critical: `>${thresholds.criticalMs} ms`,
        },
      },
    );
  },
};

export const storageProvider: HealthProvider = {
  id: "storage",
  name: "Supabase Storage",
  kind: "storage",
  weight: 1,
  async check(ctx) {
    const thresholds = STORAGE_LATENCY_THRESHOLDS;
    if (!ctx.supabase) {
      return withDiagnostics(
        resultBase(this, {
          status: "unknown",
          latencyMs: null,
          message: "Supabase client not provided.",
        }),
        {
          reason: "No Supabase client available for storage probe.",
          thresholds,
        },
      );
    }

    const started = performance.now();
    try {
      const bucketsResult = await ctx.supabase.storage.listBuckets();
      const probe = await ctx.supabase.storage
        .from(PUBLICATION_MEDIA_BUCKET)
        .list("", { limit: 1 });
      const latencyMs = Math.round(performance.now() - started);

      if (bucketsResult.error) {
        return withDiagnostics(
          resultBase(this, {
            status: "critical",
            latencyMs,
            message: bucketsResult.error.message,
            lastFailure: bucketsResult.error.message,
            lastFailureAt: new Date().toISOString(),
          }),
          {
            reason: `listBuckets failed: ${bucketsResult.error.message}`,
            suggestedAction:
              "Confirm storage permissions for the signed-in role or use a service-role probe path.",
            thresholds,
            technicalDetails: { error: bucketsResult.error.message },
          },
        );
      }

      const buckets = bucketsResult.data ?? [];
      let objectSample = 0;
      let largestBucket: { id: string; sampleCount: number } | null = null;
      let lastUpload: string | null = null;

      for (const bucket of buckets.slice(0, 12)) {
        const listed = await ctx.supabase.storage
          .from(bucket.id)
          .list("", { limit: 100, sortBy: { column: "updated_at", order: "desc" } });
        if (listed.error) continue;
        const files = (listed.data ?? []).filter((f) => f.metadata);
        objectSample += files.length;
        if (!largestBucket || files.length > largestBucket.sampleCount) {
          largestBucket = { id: bucket.id, sampleCount: files.length };
        }
        const top = files[0]?.updated_at;
        if (top && (!lastUpload || top > lastUpload)) lastUpload = top;
      }

      if (probe.error) {
        const { status, reason } = latencyReason(latencyMs, thresholds);
        return withDiagnostics(
          resultBase(this, {
            status: status === "healthy" ? "warning" : status,
            latencyMs,
            message: probe.error.message,
            lastFailure: probe.error.message,
            lastFailureAt: new Date().toISOString(),
            meta: { bucket: PUBLICATION_MEDIA_BUCKET, bucketCount: buckets.length },
          }),
          {
            reason: `Bucket probe on ${PUBLICATION_MEDIA_BUCKET} failed: ${probe.error.message}`,
            suggestedAction: "Verify bucket exists and storage policies allow list.",
            thresholds,
            technicalDetails: {
              bucketCount: buckets.length,
              buckets: buckets.map((b) => ({ id: b.id, public: b.public })),
              objectCountSample: objectSample,
              largestBucket,
              lastUpload,
              probeBucket: PUBLICATION_MEDIA_BUCKET,
              error: probe.error.message,
            },
          },
        );
      }

      const { status, reason } = latencyReason(latencyMs, thresholds);
      return withDiagnostics(
        resultBase(this, {
          status,
          latencyMs,
          message: `${buckets.length} buckets · sample ${objectSample} objects · ${latencyMs} ms`,
          lastSuccessAt: new Date().toISOString(),
          meta: {
            bucketCount: buckets.length,
            objectCountSample: objectSample,
            largestBucket,
            lastUpload,
          },
        }),
        {
          reason,
          thresholds,
          technicalDetails: {
            bucketCount: buckets.length,
            objectCountSample: objectSample,
            objectCountNote:
              "Sampled up to 100 objects per bucket via Storage API (not a full catalog count).",
            totalStorageSize: "Not available via Storage API without full object listing",
            largestBucket,
            lastUpload,
            buckets: buckets.map((b) => ({ id: b.id, public: b.public })),
            probeBucket: PUBLICATION_MEDIA_BUCKET,
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return withDiagnostics(
        resultBase(this, {
          status: "offline",
          latencyMs: null,
          message,
          lastFailure: message,
          lastFailureAt: new Date().toISOString(),
        }),
        {
          reason: `Storage probe threw: ${message}`,
          suggestedAction: "Confirm Supabase Storage is online and credentials are valid.",
          thresholds,
          technicalDetails: { error: message },
        },
      );
    }
  },
};

export const realtimeProvider: HealthProvider = {
  id: "realtime",
  name: "Supabase Realtime",
  kind: "infrastructure",
  weight: 0.6,
  async check() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    if (!url) {
      return withDiagnostics(
        resultBase(this, {
          status: "unknown",
          latencyMs: null,
          message: "Supabase URL not configured.",
        }),
        {
          reason: "NEXT_PUBLIC_SUPABASE_URL is missing; Realtime cannot be inferred.",
          suggestedAction: "Set NEXT_PUBLIC_SUPABASE_URL for this environment.",
        },
      );
    }
    return withDiagnostics(
      resultBase(this, {
        status: "healthy",
        latencyMs: null,
        message: "Realtime endpoint assumed available with Supabase project.",
        score: 80,
        meta: { note: "WebSocket probe not yet implemented" },
      }),
      {
        reason:
          "No dedicated WebSocket probe yet; status is inferred from Supabase project configuration.",
        suggestedAction:
          "Optional: add a Realtime channel subscribe/unsubscribe probe for stricter verification.",
        technicalDetails: {
          projectUrl: url,
          probe: "inferred",
        },
      },
    );
  },
};

export const bullMqProvider: HealthProvider = {
  id: "bullmq",
  name: "BullMQ",
  kind: "queue",
  weight: 1.2,
  async check() {
    if (!isRedisConfigured()) {
      if (isOpsLocalRuntime()) {
        return withDiagnostics(
          resultBase(this, {
            status: "expected",
            latencyMs: null,
            message: localExpectationMessage(
              "BullMQ unavailable because Redis is not configured locally.",
            ),
            score: scoreFromStatus("expected"),
            meta: { localExpected: true },
          }),
          {
            reason:
              "BullMQ unavailable because Redis is not configured locally.",
            suggestedAction:
              "Set REDIS_URL=redis://127.0.0.1:6379 and start local Redis when you need queues.",
            technicalDetails: {
              waiting: 0,
              active: 0,
              delayed: 0,
              completed: 0,
              failed: 0,
              retries: 0,
              workerCount: 0,
            },
          },
        );
      }

      return withDiagnostics(
        resultBase(this, {
          status: "offline",
          latencyMs: null,
          message: "BullMQ unavailable — Redis not configured.",
        }),
        {
          reason: "BullMQ depends on Redis; REDIS_URL is not configured.",
          suggestedAction: "Configure REDIS_URL, then restart workers.",
          technicalDetails: {
            waiting: 0,
            active: 0,
            delayed: 0,
            completed: 0,
            failed: 0,
            retries: 0,
            workerCount: 0,
          },
        },
      );
    }

    const redis = await checkRedisHealth();
    if (!redis.connected) {
      return withDiagnostics(
        resultBase(this, {
          status: "offline",
          latencyMs: redis.latencyMs,
          message: "BullMQ offline — Redis down.",
          lastFailure: redis.error ?? "Redis down",
          lastFailureAt: new Date().toISOString(),
        }),
        {
          reason: "Redis is down, so the BullMQ broker is offline.",
          suggestedAction: "Restore Redis connectivity before diagnosing queue workers.",
          technicalDetails: { redisError: redis.error },
        },
      );
    }

    const stats = await Promise.all(
      DISCOVERY_WORKER_QUEUES.map((name) => getQueueStats(name)),
    );
    const totals = stats.reduce(
      (acc, s) => ({
        waiting: acc.waiting + s.waiting,
        active: acc.active + s.active,
        delayed: acc.delayed + s.delayed,
        completed: acc.completed + s.completed,
        failed: acc.failed + s.failed,
        retries: acc.retries + s.delayed,
      }),
      { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0, retries: 0 },
    );

    const status =
      totals.failed > 100 ? "critical" : totals.failed > 25 ? "warning" : "healthy";
    const reason =
      status === "healthy"
        ? "Queue broker reachable via Redis; failed-job volume within tolerance."
        : `Elevated failed jobs across discovery queues (failed=${totals.failed}).`;

    return withDiagnostics(
      resultBase(this, {
        status,
        latencyMs: redis.latencyMs,
        message: `Wait ${totals.waiting} · Active ${totals.active} · Failed ${totals.failed}`,
        lastSuccessAt: new Date().toISOString(),
        score: scoreFromStatus(status),
        meta: totals,
      }),
      {
        reason,
        suggestedAction:
          status === "healthy"
            ? "No action required."
            : "Inspect failed jobs in the Queues tab and worker logs; retry or dead-letter as needed.",
        technicalDetails: {
          ...totals,
          workerCountHint:
            "See Worker card for discovery-worker heartbeat (not a BullMQ replica count).",
          queuesSampled: DISCOVERY_WORKER_QUEUES.length,
        },
      },
    );
  },
};
