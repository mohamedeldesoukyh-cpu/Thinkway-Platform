import type { WorkerOptions } from "bullmq";

import {
  CREATOR_IMPORT_CHUNK_LOCK_DURATION_MS,
  CREATOR_IMPORT_PREPARE_LOCK_DURATION_MS,
  CREATOR_IMPORT_WORKER_CONCURRENCY,
} from "./constants";

type ImportWorkerLockOptions = Pick<
  WorkerOptions,
  "lockDuration" | "lockRenewTime" | "stalledInterval" | "maxStalledCount"
>;

function importWorkerLockOptions(lockDurationMs: number): ImportWorkerLockOptions {
  const renewIntervalMs = Math.floor(lockDurationMs / 2);
  return {
    lockDuration: lockDurationMs,
    lockRenewTime: renewIntervalMs,
    stalledInterval: renewIntervalMs,
    maxStalledCount: 2,
  };
}

export const CREATOR_IMPORT_WORKER_OPTIONS = {
  ...importWorkerLockOptions(CREATOR_IMPORT_PREPARE_LOCK_DURATION_MS),
  concurrency: CREATOR_IMPORT_WORKER_CONCURRENCY,
} satisfies Partial<WorkerOptions>;

export const CREATOR_IMPORT_CHUNK_WORKER_OPTIONS = {
  ...importWorkerLockOptions(CREATOR_IMPORT_CHUNK_LOCK_DURATION_MS),
  // PDF avatar extraction is CPU-heavy; keep chunks serial to avoid event-loop stalls.
  concurrency: 1,
} satisfies Partial<WorkerOptions>;
