import { existsSync } from "node:fs";
import path from "node:path";

import { REQUIRED_ENV_KEYS } from "@/lib/production/production-readiness";

import {
  DISCOVERY_WORKER_PROCESS,
  getOpsRuntimeMode,
  type OpsRuntimeMode,
} from "../environment/runtime-context";
import type {
  HealthCheckResult,
  ReleaseReadiness,
  ReleaseReadinessCheck,
  WorkerHealthSummary,
} from "../types";

function componentStatus(
  components: HealthCheckResult[],
  id: string,
): HealthCheckResult | undefined {
  return components.find((c) => c.id === id);
}

function isPassingComponent(c: HealthCheckResult | undefined): boolean {
  if (!c) return false;
  return (
    c.status === "healthy" ||
    c.status === "expected" ||
    c.status === "warning"
  );
}

function isHardFail(c: HealthCheckResult | undefined): boolean {
  if (!c) return true;
  return c.status === "offline" || c.status === "critical";
}

function envPresent(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

function buildArtifactPresent(): boolean {
  return existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));
}

/**
 * Release readiness for Operations Center — live infra + env gates.
 * TypeScript / Build are manual verification steps unless a build artifact exists.
 */
export function evaluateReleaseReadiness(input: {
  components: HealthCheckResult[];
  worker: WorkerHealthSummary;
  runtimeMode?: OpsRuntimeMode;
}): ReleaseReadiness {
  const runtimeMode = input.runtimeMode ?? getOpsRuntimeMode();
  const local = runtimeMode === "local";
  const checks: ReleaseReadinessCheck[] = [];

  const supabase = componentStatus(input.components, "supabase");
  const redis = componentStatus(input.components, "redis");
  const bullmq = componentStatus(input.components, "bullmq");
  const storage = componentStatus(input.components, "storage");

  // TypeScript — not re-run on every snapshot (too slow for the health page)
  checks.push({
    id: "typescript",
    label: "TypeScript",
    status: "manual",
    detail: local
      ? "Not re-checked here. Before deploy run: npx tsc --noEmit"
      : "Assumed verified by CI/CD before this deployment. Re-run locally with: npx tsc --noEmit",
    blocksRelease: false,
  });

  // Build
  const hasBuild = buildArtifactPresent();
  checks.push({
    id: "build",
    label: "Build",
    status: hasBuild || !local ? "pass" : "manual",
    detail: hasBuild
      ? ".next/BUILD_ID present (local or CI build artifact)."
      : local
        ? "No .next/BUILD_ID found. Before deploy run: npm run build"
        : "Running on a deployed host — build gate assumed passed by the deploy pipeline.",
    blocksRelease: false,
  });

  // Database / Supabase
  if (!supabase) {
    checks.push({
      id: "database",
      label: "Database",
      status: "fail",
      detail: "Supabase/database probe missing from health snapshot.",
      blocksRelease: true,
    });
  } else if (supabase.status === "expected") {
    checks.push({
      id: "database",
      label: "Database",
      status: "expected_local",
      detail: supabase.message ?? "Expected in local development.",
      blocksRelease: false,
    });
  } else if (isHardFail(supabase)) {
    checks.push({
      id: "database",
      label: "Database",
      status: "fail",
      detail: supabase.message ?? "Database probe failed.",
      blocksRelease: true,
    });
  } else {
    checks.push({
      id: "database",
      label: "Database",
      status: "pass",
      detail:
        supabase.latencyMs != null
          ? `Reachable · ${supabase.latencyMs} ms`
          : (supabase.message ?? "Reachable"),
      blocksRelease: false,
    });
  }

  // Redis
  if (!redis) {
    checks.push({
      id: "redis",
      label: "Redis",
      status: "fail",
      detail: "Redis probe missing.",
      blocksRelease: true,
    });
  } else if (redis.status === "expected") {
    checks.push({
      id: "redis",
      label: "Redis",
      status: "expected_local",
      detail: "Redis is not configured locally.",
      blocksRelease: false,
    });
  } else if (isHardFail(redis)) {
    checks.push({
      id: "redis",
      label: "Redis",
      status: "fail",
      detail: redis.message ?? "Redis unreachable.",
      blocksRelease: true,
    });
  } else {
    checks.push({
      id: "redis",
      label: "Redis",
      status: "pass",
      detail:
        redis.latencyMs != null
          ? `PING ok · ${redis.latencyMs} ms`
          : (redis.message ?? "Connected"),
      blocksRelease: false,
    });
  }

  // BullMQ
  if (!bullmq) {
    checks.push({
      id: "bullmq",
      label: "BullMQ",
      status: "fail",
      detail: "BullMQ probe missing.",
      blocksRelease: true,
    });
  } else if (bullmq.status === "expected") {
    checks.push({
      id: "bullmq",
      label: "BullMQ",
      status: "expected_local",
      detail: "BullMQ depends on local Redis (optional until you run queues).",
      blocksRelease: false,
    });
  } else if (isHardFail(bullmq)) {
    checks.push({
      id: "bullmq",
      label: "BullMQ",
      status: "fail",
      detail: bullmq.message ?? "BullMQ offline.",
      blocksRelease: true,
    });
  } else {
    checks.push({
      id: "bullmq",
      label: "BullMQ",
      status: isPassingComponent(bullmq) ? "pass" : "fail",
      detail: bullmq.message ?? bullmq.status,
      blocksRelease: !isPassingComponent(bullmq),
    });
  }

  // Discovery worker
  if (input.worker.alive && !input.worker.stale) {
    checks.push({
      id: "discovery-worker",
      label: "Discovery Worker",
      status: "pass",
      detail: `Heartbeat fresh${input.worker.version ? ` · v${input.worker.version}` : ""}`,
      blocksRelease: false,
    });
  } else if (local) {
    checks.push({
      id: "discovery-worker",
      label: "Discovery Worker",
      status: "expected_local",
      detail: `Discovery worker is not running locally. Start with: ${DISCOVERY_WORKER_PROCESS.startCommandLocal}`,
      blocksRelease: false,
    });
  } else {
    checks.push({
      id: "discovery-worker",
      label: "Discovery Worker",
      status: "fail",
      detail: `Worker offline or stale. Start with: ${DISCOVERY_WORKER_PROCESS.startCommandProduction}`,
      blocksRelease: true,
    });
  }

  // Supabase (project + client)
  const supabaseUrl = envPresent("NEXT_PUBLIC_SUPABASE_URL");
  const anon = envPresent("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = envPresent("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && anon && service && !isHardFail(supabase)) {
    checks.push({
      id: "supabase",
      label: "Supabase",
      status: "pass",
      detail: "URL + anon + service role configured; probe not critical/offline.",
      blocksRelease: false,
    });
  } else if (local && (!supabaseUrl || !anon || !service)) {
    checks.push({
      id: "supabase",
      label: "Supabase",
      status: "fail",
      detail:
        "Missing local Supabase env (NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE).",
      blocksRelease: true,
    });
  } else if (isHardFail(supabase)) {
    checks.push({
      id: "supabase",
      label: "Supabase",
      status: "fail",
      detail: supabase?.message ?? "Supabase probe failed.",
      blocksRelease: true,
    });
  } else {
    checks.push({
      id: "supabase",
      label: "Supabase",
      status: "fail",
      detail: "Supabase credentials incomplete for this environment.",
      blocksRelease: true,
    });
  }

  // Storage
  if (!storage) {
    checks.push({
      id: "storage",
      label: "Storage",
      status: "fail",
      detail: "Storage probe missing.",
      blocksRelease: true,
    });
  } else if (isHardFail(storage)) {
    checks.push({
      id: "storage",
      label: "Storage",
      status: "fail",
      detail: storage.message ?? "Storage probe failed.",
      blocksRelease: true,
    });
  } else {
    checks.push({
      id: "storage",
      label: "Storage",
      status: "pass",
      detail: storage.message ?? "Storage reachable",
      blocksRelease: false,
    });
  }

  // Environment variables (production-required inventory)
  const missingEnv = REQUIRED_ENV_KEYS.filter((key) => !envPresent(key));
  if (missingEnv.length === 0) {
    checks.push({
      id: "env",
      label: "Environment Variables",
      status: "pass",
      detail: `All required keys present (${REQUIRED_ENV_KEYS.length}).`,
      blocksRelease: false,
    });
  } else if (local) {
    checks.push({
      id: "env",
      label: "Environment Variables",
      status: "fail",
      detail: `Missing for production deploy: ${missingEnv.join(", ")}. Local may omit some; set them on Vercel before go-live.`,
      blocksRelease: true,
    });
  } else {
    checks.push({
      id: "env",
      label: "Environment Variables",
      status: "fail",
      detail: `Missing required keys: ${missingEnv.join(", ")}`,
      blocksRelease: true,
    });
  }

  const blockers = checks
    .filter((c) => c.blocksRelease)
    .map((c) => `${c.label}: ${c.detail}`);
  const readyForProduction = blockers.length === 0;

  return {
    readyForProduction,
    runtimeMode,
    summary: readyForProduction
      ? "All release gates passed for this snapshot."
      : local
        ? "Not ready for production yet — see blockers (local expected gaps do not count as deploy blockers)."
        : "Production environment has failing release gates.",
    blockers,
    checks,
  };
}
