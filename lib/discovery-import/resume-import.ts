import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import { mergeImportPipelineMetadata, readImportMetadata, readImportPipelineMetadata } from "./chunk-progress";
import {
  creatorImportPausedStatusMigrationHint,
  isCreatorImportPausedStatusConstraintError,
  RESUMABLE_CREATOR_IMPORT_STATUSES,
} from "./constants";
import { normalizeExtractionMethod } from "./types";
import {
  enqueueCreatorImportChunkFlow,
  enqueueCreatorImportJob,
  isCreatorImportQueueAvailable,
} from "./queue";

export { RESUMABLE_CREATOR_IMPORT_STATUSES };

export type ResumeCreatorImportFileResult = {
  ok: boolean;
  message: string;
};

export async function resumeCreatorImportFile(
  supabase: SupabaseClient<Database>,
  importFileId: string,
  actorId: string | null
): Promise<ResumeCreatorImportFileResult> {
  const { data: importFile, error: loadError } = await supabase
    .from("creator_import_files")
    .select("*")
    .eq("id", importFileId)
    .single();

  if (loadError || !importFile) {
    return { ok: false, message: loadError?.message ?? "Import file not found." };
  }

  if (
    !RESUMABLE_CREATOR_IMPORT_STATUSES.includes(
      importFile.status as (typeof RESUMABLE_CREATOR_IMPORT_STATUSES)[number]
    )
  ) {
    return {
      ok: false,
      message: `Import cannot be resumed while status is "${importFile.status}".`,
    };
  }

  if (!isCreatorImportQueueAvailable()) {
    return {
      ok: false,
      message: "Import queue is unavailable. Set REDIS_URL to resume processing.",
    };
  }

  const pipeline = readImportPipelineMetadata(importFile.metadata);
  const { paused_at: _pausedAt, paused_from_status: _pausedFrom, ...pipelineWithoutPause } =
    pipeline;
  const rootMetadata = readImportMetadata(importFile.metadata);
  const resumedMetadata = {
    ...rootMetadata,
    import_pipeline: pipelineWithoutPause,
  };

  let nextStatus: "queued" | "processing" = "queued";

  const sourceStoragePath = pipeline.source_storage_path ?? importFile.storage_path;

  if (pipeline.prepared_at && pipeline.total_chunks && sourceStoragePath) {
    await enqueueCreatorImportChunkFlow({
      importFileId: importFile.id,
      totalChunks: pipeline.total_chunks,
      parser: importFile.parser_strategy ?? "unknown",
      extractedTextLength: importFile.extracted_text_length,
      extractionMethod: normalizeExtractionMethod(importFile.extraction_method),
      warning: importFile.warning_message,
      fileType: importFile.file_type,
      sourceName: importFile.source_name,
      uploadedBy: importFile.uploaded_by,
      sourceStoragePath,
    });
    nextStatus = "processing";
  } else {
    const queued = await enqueueCreatorImportJob({ importFileId: importFile.id });
    if (!queued.queued) {
      return {
        ok: false,
        message: queued.reason ?? "Could not queue import for processing.",
      };
    }
    nextStatus = "queued";
  }

  const { data: updated, error: updateError } = await supabase
    .from("creator_import_files")
    .update({
      status: nextStatus,
      metadata: resumedMetadata,
      error_message: null,
      ...(nextStatus === "processing" && !importFile.processing_started_at
        ? { processing_started_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", importFileId)
    .eq("status", "paused")
    .select("id")
    .maybeSingle();

  if (updateError) {
    if (isCreatorImportPausedStatusConstraintError(updateError.message)) {
      return {
        ok: false,
        message: `Resume requires a database update. ${creatorImportPausedStatusMigrationHint()}`,
      };
    }
    return { ok: false, message: updateError.message };
  }

  if (!updated) {
    return {
      ok: false,
      message: "Import is no longer paused.",
    };
  }

  await insertAuditLog(supabase, {
    action: "update",
    entity_type: "creator_import_file",
    entity_id: importFileId,
    actor_id: actorId ?? importFile.uploaded_by,
    metadata: {
      operation: "discovery_import_resumed",
      resumed_to_status: nextStatus,
      total_chunks: pipeline.total_chunks ?? 0,
    },
  });

  return {
    ok: true,
    message: "Import processing resumed.",
  };
}
