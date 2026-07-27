/**
 * User-session-aware cancellation for enterprise discovery acquisition.
 *
 * Session heartbeat (Redis TTL) + explicit cancel (DB + Redis flag + BullMQ remove).
 * Workers cooperatively abort between Apify/import steps when the initiating session
 * is no longer active.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import IORedis from "ioredis";

import { mergeCoverageSessionIds } from "@/lib/discovery/coverage-acquisition-dedupe";
import { DISCOVERY_QUEUE_NAMES } from "@/lib/discovery/queue";
import { createBullMqQueueConnection } from "@/lib/redis/bullmq-connection";

const SESSION_KEY_PREFIX = "thinkway:discovery:acquisition:session:";
const JOB_CANCEL_KEY_PREFIX = "thinkway:discovery:acquisition:job:";

export type AcquisitionSessionConfig = {
  /** Client heartbeat interval (ms). */
  heartbeatIntervalMs: number;
  /** Redis TTL for session alive key (ms). */
  sessionTtlMs: number;
  /** Redis TTL for per-job cancel flag (ms). */
  jobCancelFlagTtlMs: number;
};

export function getAcquisitionSessionConfig(): AcquisitionSessionConfig {
  const heartbeatIntervalMs = parsePositiveInt(
    process.env.DISCOVERY_ACQUISITION_HEARTBEAT_INTERVAL_MS,
    15_000
  );
  const sessionTtlMs = parsePositiveInt(
    process.env.DISCOVERY_ACQUISITION_SESSION_TTL_MS,
    45_000
  );
  const jobCancelFlagTtlMs = parsePositiveInt(
    process.env.DISCOVERY_ACQUISITION_JOB_CANCEL_TTL_MS,
    86_400_000
  );
  return { heartbeatIntervalMs, sessionTtlMs, jobCancelFlagTtlMs };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function acquisitionSessionRedisKey(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId.trim()}`;
}

export function acquisitionJobCancelRedisKey(jobId: string): string {
  return `${JOB_CANCEL_KEY_PREFIX}${jobId.trim()}:cancel`;
}

export const ACTIVE_ACQUISITION_JOB_STATUSES = ["pending", "running"] as const;

export type CancelAcquisitionSessionResult = {
  sessionId: string;
  cancelledJobIds: string[];
  skippedJobIds: string[];
  bullmqRemoved: number;
};

let sharedRedis: IORedis | null = null;

function getRedis(): IORedis | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  if (!sharedRedis) {
    sharedRedis = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return sharedRedis;
}

/** Extend session alive TTL — called by client heartbeat. */
export async function touchAcquisitionSessionHeartbeat(
  sessionId: string
): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !sessionId.trim()) return false;
  const { sessionTtlMs } = getAcquisitionSessionConfig();
  try {
    await redis.set(
      acquisitionSessionRedisKey(sessionId),
      Date.now().toString(),
      "PX",
      sessionTtlMs
    );
    return true;
  } catch {
    return false;
  }
}

/** True when session heartbeat key exists in Redis. */
export async function isAcquisitionSessionAlive(
  sessionId: string | null | undefined
): Promise<boolean> {
  if (!sessionId?.trim()) return true;
  const redis = getRedis();
  if (!redis) return true;
  try {
    const exists = await redis.exists(acquisitionSessionRedisKey(sessionId));
    return exists === 1;
  } catch {
    return true;
  }
}

async function setJobCancelFlag(jobId: string): Promise<void> {
  const redis = getRedis();
  if (!redis || !jobId.trim()) return;
  const { jobCancelFlagTtlMs } = getAcquisitionSessionConfig();
  try {
    await redis.set(acquisitionJobCancelRedisKey(jobId), "1", "PX", jobCancelFlagTtlMs);
  } catch {
    // Best-effort.
  }
}

async function hasJobCancelFlag(jobId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !jobId.trim()) return false;
  try {
    const exists = await redis.exists(acquisitionJobCancelRedisKey(jobId));
    return exists === 1;
  } catch {
    return false;
  }
}

async function removeEnterpriseAcquisitionBullmqJob(jobId: string): Promise<boolean> {
  const connection = process.env.REDIS_URL?.trim();
  if (!connection || !jobId.trim()) return false;

  const { Queue } = await import("bullmq");
  let queue: InstanceType<typeof Queue> | null = null;
  try {
    queue = new Queue(DISCOVERY_QUEUE_NAMES.enterpriseAcquisition, {
      connection: createBullMqQueueConnection(connection),
    });
    const job = await queue.getJob(jobId);
    if (!job) return false;
    try {
      if (await job.isActive()) {
        await job.discard();
      }
      await job.remove();
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  } finally {
    if (queue) {
      await queue.close().catch(() => {});
    }
  }
}

type DiscoveryJobRow = {
  id: string;
  status: string;
  payload: Record<string, unknown> | null;
};

async function loadActiveJobsForSession(
  supabase: SupabaseClient,
  sessionId: string
): Promise<DiscoveryJobRow[]> {
  const trimmed = sessionId.trim();
  const byPrimary = await supabase
    .from("discovery_jobs")
    .select("id, status, payload")
    .in("status", [...ACTIVE_ACQUISITION_JOB_STATUSES])
    .filter("payload->>searchSessionId", "eq", trimmed);

  if (byPrimary.error) throw new Error(byPrimary.error.message);

  // Attached sessions live in payload.searchSessionIds (jsonb array).
  const byAttached = await supabase
    .from("discovery_jobs")
    .select("id, status, payload")
    .in("status", [...ACTIVE_ACQUISITION_JOB_STATUSES])
    .filter("payload->searchSessionIds", "cs", JSON.stringify([trimmed]));

  const rows = new Map<string, DiscoveryJobRow>();
  for (const row of [...(byPrimary.data ?? []), ...(byAttached.error ? [] : byAttached.data ?? [])]) {
    rows.set(String(row.id), {
      id: String(row.id),
      status: String(row.status ?? ""),
      payload: (row.payload as Record<string, unknown> | null) ?? null,
    });
  }
  return [...rows.values()];
}

async function detachSessionFromAcquisitionJob(
  supabase: SupabaseClient,
  job: DiscoveryJobRow,
  sessionId: string
): Promise<{ remainingSessionIds: string[]; payload: Record<string, unknown> }> {
  const payload =
    job.payload && typeof job.payload === "object" ? { ...job.payload } : {};
  const remainingSessionIds = mergeCoverageSessionIds(payload).filter(
    (id) => id !== sessionId
  );

  const nextPayload = {
    ...payload,
    searchSessionId: remainingSessionIds[0] ?? null,
    searchSessionIds: remainingSessionIds,
  };

  await supabase
    .from("discovery_jobs")
    .update({ payload: nextPayload })
    .eq("id", job.id)
    .in("status", [...ACTIVE_ACQUISITION_JOB_STATUSES]);

  return { remainingSessionIds, payload: nextPayload };
}

async function markDiscoveryJobCancelled(
  supabase: SupabaseClient,
  jobId: string,
  reason = "Cancelled — search session ended."
): Promise<void> {
  await supabase
    .from("discovery_jobs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      error_message: reason,
    })
    .eq("id", jobId)
    .in("status", [...ACTIVE_ACQUISITION_JOB_STATUSES]);
}

/**
 * Cancel all pending/running acquisition jobs for a search session.
 * Safe to call repeatedly; completed jobs are untouched.
 */
export async function cancelAcquisitionSession(
  supabase: SupabaseClient,
  sessionId: string,
  options?: { reason?: string }
): Promise<CancelAcquisitionSessionResult> {
  const trimmed = sessionId.trim();
  if (!trimmed) {
    return { sessionId: "", cancelledJobIds: [], skippedJobIds: [], bullmqRemoved: 0 };
  }

  const reason = options?.reason ?? "Cancelled — search session ended.";
  const jobs = await loadActiveJobsForSession(supabase, trimmed);
  const cancelledJobIds: string[] = [];
  const skippedJobIds: string[] = [];
  let bullmqRemoved = 0;

  for (const job of jobs) {
    if (!ACTIVE_ACQUISITION_JOB_STATUSES.includes(job.status as (typeof ACTIVE_ACQUISITION_JOB_STATUSES)[number])) {
      skippedJobIds.push(job.id);
      continue;
    }

    // Shared coverage jobs: detach this session; cancel only when no sessions remain.
    const { remainingSessionIds } = await detachSessionFromAcquisitionJob(
      supabase,
      job,
      trimmed
    );
    if (remainingSessionIds.length > 0) {
      skippedJobIds.push(job.id);
      console.log(
        "[coverage-acquisition-dedupe] detached session from shared job",
        JSON.stringify({
          jobId: job.id,
          sessionId: trimmed,
          remainingSessionIds,
        })
      );
      continue;
    }

    await markDiscoveryJobCancelled(supabase, job.id, reason);
    await setJobCancelFlag(job.id);
    const removed = await removeEnterpriseAcquisitionBullmqJob(job.id);
    if (removed) bullmqRemoved += 1;
    cancelledJobIds.push(job.id);
  }

  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(acquisitionSessionRedisKey(trimmed));
    } catch {
      // Best-effort.
    }
  }

  return { sessionId: trimmed, cancelledJobIds, skippedJobIds, bullmqRemoved };
}

export type AcquisitionCancellationCheck = {
  cancelled: boolean;
  reason?: string;
};

/**
 * Cooperative cancellation check for workers — DB status, Redis flag, or expired session.
 * Returns false for completed/failed jobs (never retroactively cancel success).
 */
export async function checkAcquisitionJobCancelled(
  supabase: SupabaseClient,
  jobId: string | undefined,
  searchSessionId?: string | null
): Promise<AcquisitionCancellationCheck> {
  if (!jobId?.trim()) return { cancelled: false };

  if (await hasJobCancelFlag(jobId)) {
    return { cancelled: true, reason: "Job cancel flag set." };
  }

  const { data, error } = await supabase
    .from("discovery_jobs")
    .select("status, payload")
    .eq("id", jobId.trim())
    .maybeSingle();

  if (error) {
    return { cancelled: false };
  }

  const status = String(data?.status ?? "");
  if (status === "cancelled") {
    return { cancelled: true, reason: "Job marked cancelled in database." };
  }
  if (status === "completed" || status === "failed") {
    return { cancelled: false };
  }

  const payload =
    data?.payload && typeof data.payload === "object"
      ? (data.payload as Record<string, unknown>)
      : null;
  const sessionIds = mergeCoverageSessionIds(payload);
  if (searchSessionId?.trim() && !sessionIds.includes(searchSessionId.trim())) {
    sessionIds.push(searchSessionId.trim());
  }

  if (sessionIds.length > 0) {
    let anyAlive = false;
    for (const sessionId of sessionIds) {
      if (await isAcquisitionSessionAlive(sessionId)) {
        anyAlive = true;
        break;
      }
    }
    if (!anyAlive) {
      return { cancelled: true, reason: "All attached search session heartbeats expired." };
    }
  }

  return { cancelled: false };
}

/** Mark a single job cancelled (worker mid-flight abort). */
export async function finalizeCancelledDiscoveryJob(
  supabase: SupabaseClient,
  jobId: string | undefined,
  reason: string
): Promise<void> {
  if (!jobId?.trim()) return;
  await markDiscoveryJobCancelled(supabase, jobId, reason);
  await setJobCancelFlag(jobId);
}
