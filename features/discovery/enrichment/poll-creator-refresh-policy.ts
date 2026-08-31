import type { CreatorMetricsSyncStatus } from "@/lib/services/creators/creator-enrichment-service";

export const POLL_INTERVAL_MS = 3_000;
/** Live Apify profile actors commonly take 1–3 minutes after the worker picks up the job. */
export const MAX_POLL_MS = 4 * 60 * 1000;
export const MAX_POLL_ATTEMPTS = Math.ceil(MAX_POLL_MS / POLL_INTERVAL_MS);
/**
 * Opaque "pending" before queued/collecting is visible (auth/DB blip or worker not yet
 * written). Do not abort once the job has been seen in flight — that caused a false
 * "Creator refresh failed" toast while Apify was still running.
 */
export const MAX_PENDING_STREAK_BEFORE_ACTIVE = 8;

export function isTerminalSyncStatus(status: CreatorMetricsSyncStatus): boolean {
  return status === "completed" || status === "failed";
}

/** Statuses that mean "still working" — everything else should end the poll. */
export function isActiveSyncStatus(status: CreatorMetricsSyncStatus): boolean {
  return status === "queued" || status === "collecting";
}

export function shouldAbortOpaquePending(input: {
  seenActive: boolean;
  pendingStreak: number;
}): boolean {
  if (input.seenActive) return false;
  return input.pendingStreak >= MAX_PENDING_STREAK_BEFORE_ACTIVE;
}

/** When the poll budget expires, do not report failure if the job is still in flight. */
export function pollGiveUpStatus(
  lastStatus: CreatorMetricsSyncStatus | null,
  seenActive = false
): CreatorMetricsSyncStatus {
  if (lastStatus === "queued" || lastStatus === "collecting") return lastStatus;
  if (seenActive) return "queued";
  return "failed";
}
