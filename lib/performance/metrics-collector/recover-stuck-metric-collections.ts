import type { SupabaseClient } from "@supabase/supabase-js";

import { logMetricsQueueEvent } from "@/lib/performance/metrics-collector/metrics-queue-log";
import { markPublicationRefreshStatus } from "@/lib/performance/metrics-collector/persist";
import { publicationHasInflightMetricsJob } from "@/lib/performance/metrics-collector/queue";

/** Rows in `collecting` longer than this are candidates for forced failure. */
export const STUCK_COLLECTING_THRESHOLD_MS = 15 * 60 * 1000;

/** Rows in `queued` longer than this with no BullMQ job are candidates for forced failure. */
export const STUCK_QUEUED_THRESHOLD_MS = 10 * 60 * 1000;

export type StuckCollectingRow = {
  id: string;
  campaign_header_id: string;
  metrics_refresh_status: string;
  metrics_refresh_attempted_at: string | null;
  updated_at?: string | null;
};

export function isStuckCollectingRow(
  row: StuckCollectingRow,
  nowMs: number,
  thresholdMs = STUCK_COLLECTING_THRESHOLD_MS
): boolean {
  if (row.metrics_refresh_status !== "collecting") return false;
  if (!row.metrics_refresh_attempted_at) return true;
  const attemptedAt = Date.parse(row.metrics_refresh_attempted_at);
  if (Number.isNaN(attemptedAt)) return true;
  return nowMs - attemptedAt >= thresholdMs;
}

export function shouldMarkStuckCollectingAsFailed(
  row: StuckCollectingRow,
  nowMs: number,
  hasActiveJob: boolean,
  thresholdMs = STUCK_COLLECTING_THRESHOLD_MS
): boolean {
  return isStuckCollectingRow(row, nowMs, thresholdMs) && !hasActiveJob;
}

export function isStuckQueuedRow(
  row: StuckCollectingRow,
  nowMs: number,
  thresholdMs = STUCK_QUEUED_THRESHOLD_MS
): boolean {
  if (row.metrics_refresh_status !== "queued") return false;
  const anchor = row.updated_at ?? row.metrics_refresh_attempted_at;
  if (!anchor) return true;
  const anchorMs = Date.parse(anchor);
  if (Number.isNaN(anchorMs)) return true;
  return nowMs - anchorMs >= thresholdMs;
}

export function shouldMarkStuckQueuedAsFailed(
  row: StuckCollectingRow,
  nowMs: number,
  hasActiveJob: boolean,
  thresholdMs = STUCK_QUEUED_THRESHOLD_MS
): boolean {
  return isStuckQueuedRow(row, nowMs, thresholdMs) && !hasActiveJob;
}

export type RecoverStuckMetricCollectionsResult = {
  scanned: number;
  markedFailed: number;
  skippedActiveJob: number;
  queuedScanned: number;
  queuedMarkedFailed: number;
};

/**
 * Marks stale `collecting` publications as `failed` when no BullMQ job is in flight.
 *
 * **Run location:** invoked from the hourly publication-metrics scheduler worker
 * (`publication-metrics-scheduler.ts`), not on every enqueue — avoids adding latency
 * to user-triggered collection while still recovering stuck rows within ~15–75 minutes.
 */
export async function recoverStuckMetricCollections(
  supabase: SupabaseClient,
  options?: { limit?: number; now?: Date; thresholdMs?: number }
): Promise<RecoverStuckMetricCollectionsResult> {
  const limit = options?.limit ?? 200;
  const nowMs = (options?.now ?? new Date()).getTime();
  const thresholdMs = options?.thresholdMs ?? STUCK_COLLECTING_THRESHOLD_MS;
  const cutoffIso = new Date(nowMs - thresholdMs).toISOString();

  const { data, error } = await supabase
    .from("campaign_publications")
    .select("id, campaign_header_id, metrics_refresh_status, metrics_refresh_attempted_at")
    .eq("metrics_refresh_status", "collecting")
    .or(`metrics_refresh_attempted_at.is.null,metrics_refresh_attempted_at.lt.${cutoffIso}`)
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as StuckCollectingRow[];
  let markedFailed = 0;
  let skippedActiveJob = 0;

  for (const row of rows) {
    if (!isStuckCollectingRow(row, nowMs, thresholdMs)) continue;

    const hasActiveJob = await publicationHasInflightMetricsJob(row.id);
    if (!shouldMarkStuckCollectingAsFailed(row, nowMs, hasActiveJob, thresholdMs)) {
      skippedActiveJob += 1;
      continue;
    }

    await markPublicationRefreshStatus(supabase, {
      publicationId: row.id,
      campaignHeaderId: row.campaign_header_id,
      status: "failed",
    });

    logMetricsQueueEvent("STATUS_UPDATED", {
      publicationId: row.id,
      status: "failed",
      error: "stuck_collecting_recovery",
    });

    markedFailed += 1;
  }

  const queuedCutoffIso = new Date(nowMs - STUCK_QUEUED_THRESHOLD_MS).toISOString();
  const { data: queuedData, error: queuedError } = await supabase
    .from("campaign_publications")
    .select("id, campaign_header_id, metrics_refresh_status, metrics_refresh_attempted_at, updated_at")
    .eq("metrics_refresh_status", "queued")
    .lt("updated_at", queuedCutoffIso)
    .limit(limit);

  if (queuedError) throw new Error(queuedError.message);

  const queuedRows = (queuedData ?? []) as StuckCollectingRow[];
  let queuedMarkedFailed = 0;

  for (const row of queuedRows) {
    if (!isStuckQueuedRow(row, nowMs)) continue;

    const hasActiveJob = await publicationHasInflightMetricsJob(row.id);
    if (!shouldMarkStuckQueuedAsFailed(row, nowMs, hasActiveJob)) {
      skippedActiveJob += 1;
      continue;
    }

    await markPublicationRefreshStatus(supabase, {
      publicationId: row.id,
      campaignHeaderId: row.campaign_header_id,
      status: "failed",
    });

    logMetricsQueueEvent("STATUS_UPDATED", {
      publicationId: row.id,
      status: "failed",
      error: "stuck_queued_recovery",
    });

    queuedMarkedFailed += 1;
  }

  return {
    scanned: rows.length,
    markedFailed,
    skippedActiveJob,
    queuedScanned: queuedRows.length,
    queuedMarkedFailed,
  };
}
