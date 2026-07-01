import type { SupabaseClient } from "@supabase/supabase-js";

import {
  STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS,
  STUCK_RUNNING_ENRICHMENT_THRESHOLD_MS,
} from "./constants";
import { creatorHasInflightEnrichmentJob } from "./queue";
import type { CreatorEnrichmentStatus } from "./types";

export {
  STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS,
  STUCK_RUNNING_ENRICHMENT_THRESHOLD_MS,
};

export type StuckEnrichmentRow = {
  id: string;
  enrichment_status: string;
  last_enriched_at: string | null;
  updated_at: string | null;
};

export function isStuckQueuedEnrichmentRow(
  row: StuckEnrichmentRow,
  nowMs: number,
  thresholdMs = STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS
): boolean {
  if (row.enrichment_status !== "queued") return false;
  if (!row.updated_at) return true;
  const updatedMs = Date.parse(row.updated_at);
  if (Number.isNaN(updatedMs)) return true;
  return nowMs - updatedMs >= thresholdMs;
}

export function isStuckRunningEnrichmentRow(
  row: StuckEnrichmentRow,
  nowMs: number,
  thresholdMs = STUCK_RUNNING_ENRICHMENT_THRESHOLD_MS
): boolean {
  if (row.enrichment_status !== "running") return false;
  if (!row.updated_at) return true;
  const updatedMs = Date.parse(row.updated_at);
  if (Number.isNaN(updatedMs)) return true;
  return nowMs - updatedMs >= thresholdMs;
}

export function resolveStuckQueuedEnrichmentStatus(
  row: StuckEnrichmentRow
): CreatorEnrichmentStatus {
  return row.last_enriched_at ? "failed" : "never";
}

export type RecoverStuckCreatorEnrichmentsResult = {
  queuedScanned: number;
  queuedReset: number;
  runningScanned: number;
  runningFailed: number;
  skippedActiveJob: number;
};

/**
 * Clears orphaned `queued` / `running` influencer rows when no BullMQ job exists.
 *
 * Run from the discovery worker on startup and periodically so backlog from
 * offline workers or the skip-path bug does not persist indefinitely.
 */
export async function recoverStuckCreatorEnrichments(
  supabase: SupabaseClient,
  options?: { limit?: number; now?: Date; thresholdMs?: number }
): Promise<RecoverStuckCreatorEnrichmentsResult> {
  const limit = options?.limit ?? 500;
  const nowMs = (options?.now ?? new Date()).getTime();
  const queuedThresholdMs = options?.thresholdMs ?? STUCK_QUEUED_ENRICHMENT_THRESHOLD_MS;
  const queuedCutoffIso = new Date(nowMs - queuedThresholdMs).toISOString();
  const runningCutoffIso = new Date(
    nowMs - STUCK_RUNNING_ENRICHMENT_THRESHOLD_MS
  ).toISOString();

  let queuedReset = 0;
  let runningFailed = 0;
  let skippedActiveJob = 0;

  const { data: queuedData, error: queuedError } = await supabase
    .from("influencers")
    .select("id, enrichment_status, last_enriched_at, updated_at")
    .eq("enrichment_status", "queued")
    .lt("updated_at", queuedCutoffIso)
    .limit(limit);

  if (queuedError) throw new Error(queuedError.message);

  const queuedRows = (queuedData ?? []) as StuckEnrichmentRow[];

  for (const row of queuedRows) {
    if (!isStuckQueuedEnrichmentRow(row, nowMs, queuedThresholdMs)) continue;

    const hasActiveJob = await creatorHasInflightEnrichmentJob(row.id);
    if (hasActiveJob) {
      skippedActiveJob += 1;
      continue;
    }

    const nextStatus = resolveStuckQueuedEnrichmentStatus(row);
    const { error } = await supabase
      .from("influencers")
      .update({ enrichment_status: nextStatus } as never)
      .eq("id", row.id)
      .eq("enrichment_status", "queued");

    if (!error) queuedReset += 1;
  }

  const { data: runningData, error: runningError } = await supabase
    .from("influencers")
    .select("id, enrichment_status, last_enriched_at, updated_at")
    .eq("enrichment_status", "running")
    .lt("updated_at", runningCutoffIso)
    .limit(limit);

  if (runningError) throw new Error(runningError.message);

  const runningRows = (runningData ?? []) as StuckEnrichmentRow[];

  for (const row of runningRows) {
    if (!isStuckRunningEnrichmentRow(row, nowMs)) continue;

    const hasActiveJob = await creatorHasInflightEnrichmentJob(row.id);
    if (hasActiveJob) {
      skippedActiveJob += 1;
      continue;
    }

    const { error } = await supabase
      .from("influencers")
      .update({ enrichment_status: "failed" } as never)
      .eq("id", row.id)
      .eq("enrichment_status", "running");

    if (!error) runningFailed += 1;
  }

  return {
    queuedScanned: queuedRows.length,
    queuedReset,
    runningScanned: runningRows.length,
    runningFailed,
    skippedActiveJob,
  };
}
