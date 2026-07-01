import type { SupabaseClient } from "@supabase/supabase-js";

import { STUCK_QUEUED_IMPORT_THRESHOLD_MS } from "@/lib/creator-enrichment/constants";
import type { Database } from "@/types/database";

import { readImportPipelineMetadata } from "./chunk-progress";
import {
  creatorImportFileHasInflightJob,
  enqueueCreatorImportChunkFlow,
  enqueueCreatorImportJob,
} from "./queue";
import { normalizeExtractionMethod } from "./types";

export type StuckImportFileRow = {
  id: string;
  status: string;
  updated_at: string | null;
};

export type StuckProcessingImportFileRow = StuckImportFileRow & {
  metadata: unknown;
  parser_strategy: string | null;
  extracted_text_length: number | null;
  extraction_method: string | null;
  warning_message: string | null;
  file_type: string;
  source_name: string | null;
  uploaded_by: string | null;
  storage_path: string | null;
};

export function isStuckQueuedImportFileRow(
  row: StuckImportFileRow,
  nowMs: number,
  thresholdMs = STUCK_QUEUED_IMPORT_THRESHOLD_MS
): boolean {
  if (row.status !== "queued") return false;
  if (!row.updated_at) return true;
  const updatedMs = Date.parse(row.updated_at);
  if (Number.isNaN(updatedMs)) return true;
  return nowMs - updatedMs >= thresholdMs;
}

export function isStuckProcessingImportFileRow(
  row: StuckImportFileRow,
  nowMs: number,
  thresholdMs = STUCK_QUEUED_IMPORT_THRESHOLD_MS
): boolean {
  if (row.status !== "processing") return false;
  if (!row.updated_at) return true;
  const updatedMs = Date.parse(row.updated_at);
  if (Number.isNaN(updatedMs)) return true;
  return nowMs - updatedMs >= thresholdMs;
}

export type RecoverStuckImportFilesResult = {
  scanned: number;
  resetToUploaded: number;
  skippedActiveJob: number;
  requeuedProcessing: number;
};

/**
 * Reverts import files stuck in `queued` when the creator-import worker never picked them up,
 * and re-enqueues imports stuck in `processing` with no inflight BullMQ jobs (worker restart).
 */
export async function recoverStuckCreatorImportFiles(
  supabase: SupabaseClient,
  options?: { limit?: number; now?: Date; thresholdMs?: number }
): Promise<RecoverStuckImportFilesResult> {
  const limit = options?.limit ?? 200;
  const nowMs = (options?.now ?? new Date()).getTime();
  const thresholdMs = options?.thresholdMs ?? STUCK_QUEUED_IMPORT_THRESHOLD_MS;
  const cutoffIso = new Date(nowMs - thresholdMs).toISOString();

  const [queuedResult, processingResult] = await Promise.all([
    supabase
      .from("creator_import_files")
      .select("id, status, updated_at")
      .eq("status", "queued")
      .lt("updated_at", cutoffIso)
      .limit(limit),
    supabase
      .from("creator_import_files")
      .select(
        "id, status, updated_at, metadata, parser_strategy, extracted_text_length, extraction_method, warning_message, file_type, source_name, uploaded_by, storage_path"
      )
      .eq("status", "processing")
      .lt("updated_at", cutoffIso)
      .limit(limit),
  ]);

  if (queuedResult.error) throw new Error(queuedResult.error.message);
  if (processingResult.error) throw new Error(processingResult.error.message);

  const rows = [
    ...((queuedResult.data ?? []) as StuckImportFileRow[]),
    ...((processingResult.data ?? []) as StuckProcessingImportFileRow[]),
  ];

  let resetToUploaded = 0;
  let skippedActiveJob = 0;
  let requeuedProcessing = 0;

  for (const row of rows) {
    const stuckQueued = isStuckQueuedImportFileRow(row, nowMs, thresholdMs);
    const stuckProcessing = isStuckProcessingImportFileRow(row, nowMs, thresholdMs);
    if (!stuckQueued && !stuckProcessing) continue;

    const hasActiveJob = await creatorImportFileHasInflightJob(row.id);
    if (hasActiveJob) {
      skippedActiveJob += 1;
      continue;
    }

    if (stuckQueued) {
      const { error: updateError } = await supabase
        .from("creator_import_files")
        .update({
          status: "uploaded",
          error_message:
            "Import worker did not process this file within the queue timeout. Re-upload or retry when discovery-worker is running.",
        })
        .eq("id", row.id)
        .eq("status", "queued");

      if (!updateError) resetToUploaded += 1;
      continue;
    }

    const processingRow = row as StuckProcessingImportFileRow;
    const pipeline = readImportPipelineMetadata(
      processingRow.metadata as Database["public"]["Tables"]["creator_import_files"]["Row"]["metadata"]
    );
    const sourceStoragePath =
      pipeline.source_storage_path ?? processingRow.storage_path ?? null;
    const canResumeChunks =
      Boolean(pipeline.prepared_at && pipeline.total_chunks && sourceStoragePath);

    if (canResumeChunks && sourceStoragePath) {
      await enqueueCreatorImportChunkFlow({
        importFileId: processingRow.id,
        totalChunks: pipeline.total_chunks!,
        parser: processingRow.parser_strategy ?? "unknown",
        extractedTextLength: processingRow.extracted_text_length,
        extractionMethod: normalizeExtractionMethod(processingRow.extraction_method),
        warning: processingRow.warning_message,
        fileType: processingRow.file_type,
        sourceName: processingRow.source_name,
        uploadedBy: processingRow.uploaded_by,
        sourceStoragePath,
      });
      requeuedProcessing += 1;
      continue;
    }

    const requeue = await enqueueCreatorImportJob({ importFileId: processingRow.id });
    if (requeue.queued) {
      requeuedProcessing += 1;
    }
  }

  return {
    scanned: rows.length,
    resetToUploaded,
    skippedActiveJob,
    requeuedProcessing,
  };
}
