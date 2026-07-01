import type { Job } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import { removeCreatorImportObject } from "@/lib/supabase/storage";
import type { Database } from "@/types/database";

import {
  aggregateChunkCounters,
  chunkProgressPercent,
  isChunkCompleted,
  mergeImportPipelineMetadata,
  readImportPipelineMetadata,
  recordChunkProgress,
} from "./chunk-progress";
import { normalizeExtractionMethod } from "./types";
import { CREATOR_IMPORT_CHUNK_SIZE } from "./constants";
import { uploadImportCreatorAvatar } from "./import-avatar-storage";
import { parseImportFile } from "./parsers";
import {
  extractPdfCreatorAvatarBuffers,
  logPdfAvatarExtraction,
} from "./parsers/pdf-avatars";
import { enqueueCreatorImportChunkFlow, creatorImportFileHasInflightJob } from "./queue";
import {
  downloadCreatorImportChunk,
  downloadCreatorImportFile,
  removeCreatorImportChunks,
  uploadCreatorImportChunk,
} from "./storage";
import type {
  CreatorImportChunkJobPayload,
  CreatorImportFinalizeJobPayload,
  ImportProcessingLog,
  ImportProcessingLogEntry,
  ParsedCreatorRow,
} from "./types";
import { upsertImportedCreators } from "./upsert";

type ProcessImportFileInput = {
  supabase: SupabaseClient<Database>;
  importFileId: string;
};

type ImportLogContext = {
  entries: ImportProcessingLogEntry[];
  errors: NonNullable<ImportProcessingLog["errors"]>;
  log: (level: ImportProcessingLogEntry["level"], message: string) => void;
};

function createImportLogContext(): ImportLogContext {
  const entries: ImportProcessingLogEntry[] = [];
  const errors: NonNullable<ImportProcessingLog["errors"]> = [];

  return {
    entries,
    errors,
    log(level, message) {
      entries.push({ at: new Date().toISOString(), level, message });
    },
  };
}

function splitCreatorRows(rows: ParsedCreatorRow[]): ParsedCreatorRow[][] {
  const chunks: ParsedCreatorRow[][] = [];
  for (let index = 0; index < rows.length; index += CREATOR_IMPORT_CHUNK_SIZE) {
    chunks.push(rows.slice(index, index + CREATOR_IMPORT_CHUNK_SIZE));
  }
  return chunks;
}

/** Parse the full file, persist chunks, and queue BullMQ child jobs (max 100 creators each). */
export async function prepareCreatorImportFile(
  input: ProcessImportFileInput
): Promise<{ totalChunks: number; totalCreators: number }> {
  const { entries, errors, log } = createImportLogContext();
  const startedAt = Date.now();

  const { data: importFile, error: loadError } = await input.supabase
    .from("creator_import_files")
    .select("*")
    .eq("id", input.importFileId)
    .single();

  if (loadError || !importFile) {
    throw new Error(loadError?.message ?? "Import file not found.");
  }

  if (!importFile.storage_path) {
    throw new Error("Import file has no storage path.");
  }

  if (importFile.status === "failed" || importFile.status === "completed") {
    const pipeline = readImportPipelineMetadata(importFile.metadata);
    return {
      totalChunks: pipeline.total_chunks ?? 0,
      totalCreators: importFile.total_creators ?? 0,
    };
  }

  if (importFile.status === "paused") {
    log("info", "Import is paused; skipping prepare.");
    const pipeline = readImportPipelineMetadata(importFile.metadata);
    return {
      totalChunks: pipeline.total_chunks ?? 0,
      totalCreators: importFile.total_creators ?? 0,
    };
  }

  const existingPipeline = readImportPipelineMetadata(importFile.metadata);
  if (existingPipeline.prepared_at && existingPipeline.total_chunks) {
    if (await creatorImportFileHasInflightJob(input.importFileId)) {
      return {
        totalChunks: existingPipeline.total_chunks,
        totalCreators: importFile.total_creators ?? 0,
      };
    }

    log(
      "info",
      `Import already prepared with ${existingPipeline.total_chunks} chunk(s); re-queueing chunk jobs`
    );
    await enqueueCreatorImportChunkFlow({
      importFileId: input.importFileId,
      totalChunks: existingPipeline.total_chunks,
      parser: importFile.parser_strategy ?? "unknown",
      extractedTextLength: importFile.extracted_text_length,
      extractionMethod: normalizeExtractionMethod(importFile.extraction_method),
      warning: importFile.warning_message,
      fileType: importFile.file_type,
      sourceName: importFile.source_name,
      uploadedBy: importFile.uploaded_by,
      sourceStoragePath: existingPipeline.source_storage_path ?? importFile.storage_path,
    });
    return {
      totalChunks: existingPipeline.total_chunks,
      totalCreators: importFile.total_creators ?? 0,
    };
  }

  const { data: markedProcessing } = await input.supabase
    .from("creator_import_files")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", input.importFileId)
    .in("status", ["uploaded", "queued", "processing"])
    .select("id")
    .maybeSingle();

  if (!markedProcessing) {
    log("info", "Import is no longer active; skipping prepare.");
    const pipeline = readImportPipelineMetadata(importFile.metadata);
    return {
      totalChunks: pipeline.total_chunks ?? 0,
      totalCreators: importFile.total_creators ?? 0,
    };
  }

  log("info", `Preparing ${importFile.filename} (${importFile.file_type})`);

  try {
    const buffer = await downloadCreatorImportFile({
      supabase: input.supabase,
      storagePath: importFile.storage_path,
    });

    const parsed = await parseImportFile({
      fileType: importFile.file_type,
      buffer,
      sourceName: importFile.source_name,
    });

    if (importFile.file_type === "pdf" && parsed.rows.length > 0) {
      await attachPdfImportAvatars({
        buffer,
        rows: parsed.rows,
        importFileId: input.importFileId,
        supabase: input.supabase,
        log,
      });
    }

    const rowChunks = splitCreatorRows(parsed.rows);
    const totalChunks = Math.max(rowChunks.length, 1);

    log("info", `Parser ${parsed.parser} extracted ${parsed.rows.length} creator row(s)`);
    if (parsed.diagnostics.warning) {
      log("warn", parsed.diagnostics.warning);
    }
    log("info", `Split into ${totalChunks} chunk job(s) of up to ${CREATOR_IMPORT_CHUNK_SIZE}`);

    if (rowChunks.length === 0) {
      await uploadCreatorImportChunk({
        supabase: input.supabase,
        importFileId: input.importFileId,
        chunkIndex: 0,
        rows: [],
      });
    } else {
      for (let chunkIndex = 0; chunkIndex < rowChunks.length; chunkIndex += 1) {
        await uploadCreatorImportChunk({
          supabase: input.supabase,
          importFileId: input.importFileId,
          chunkIndex,
          rows: rowChunks[chunkIndex],
        });
      }
    }

    const preparedMetadata = mergeImportPipelineMetadata(importFile.metadata, {
      prepared_at: new Date().toISOString(),
      total_chunks: totalChunks,
      source_storage_path: importFile.storage_path,
      chunk_results: {},
    });

    const { data: importStillActive } = await input.supabase
      .from("creator_import_files")
      .select("status")
      .eq("id", input.importFileId)
      .in("status", ["uploaded", "queued", "processing"])
      .maybeSingle();

    if (!importStillActive) {
      log("info", "Import was cancelled or finished during prepare; skipping chunk enqueue.");
      return {
        totalChunks: totalChunks,
        totalCreators: parsed.rows.length,
      };
    }

    await input.supabase
      .from("creator_import_files")
      .update({
        metadata: preparedMetadata,
        total_creators: parsed.rows.length,
        imported_creators: 0,
        updated_creators: 0,
        duplicate_creators: 0,
        failed_creators: 0,
        parser_strategy: parsed.parser,
        extracted_text_length: parsed.diagnostics.extractedTextLength,
        extraction_method: parsed.diagnostics.extractionMethod,
        warning_message: parsed.diagnostics.warning,
        processing_log: {
          parser: parsed.parser,
          file_type: importFile.file_type,
          duration_ms: Date.now() - startedAt,
          errors,
          entries,
        },
      })
      .eq("id", input.importFileId);

    await enqueueCreatorImportChunkFlow({
      importFileId: input.importFileId,
      totalChunks,
      parser: parsed.parser,
      extractedTextLength: parsed.diagnostics.extractedTextLength,
      extractionMethod: parsed.diagnostics.extractionMethod,
      warning: parsed.diagnostics.warning,
      fileType: importFile.file_type,
      sourceName: importFile.source_name,
      uploadedBy: importFile.uploaded_by,
      sourceStoragePath: importFile.storage_path,
    });

    return { totalChunks, totalCreators: parsed.rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import preparation failed";
    log("error", message);
    errors.push({ message });

    await input.supabase
      .from("creator_import_files")
      .update({
        status: "failed",
        error_message: message,
        processing_completed_at: new Date().toISOString(),
        processing_log: {
          file_type: importFile.file_type,
          duration_ms: Date.now() - startedAt,
          errors,
          entries,
        },
      })
      .eq("id", input.importFileId);

    await insertAuditLog(input.supabase, {
      action: "update",
      entity_type: "creator_import_file",
      entity_id: input.importFileId,
      actor_id: importFile.uploaded_by,
      metadata: {
        operation: "discovery_import_failed",
        error: message,
        stage: "prepare",
      },
    });

    throw error;
  }
}

/** Process one chunk (<=100 creators). */
export async function processCreatorImportChunk(
  input: ProcessImportFileInput & {
    payload: CreatorImportChunkJobPayload;
    job?: Job<CreatorImportChunkJobPayload>;
  }
): Promise<{ chunkIndex: number; skipped: boolean; skipReason?: string }> {
  const { data: importFile, error: loadError } = await input.supabase
    .from("creator_import_files")
    .select("status, metadata, processing_log")
    .eq("id", input.importFileId)
    .single();

  if (loadError || !importFile) {
    throw new Error(loadError?.message ?? "Import file not found.");
  }

  if (importFile.status === "failed" || importFile.status === "completed") {
    return {
      chunkIndex: input.payload.chunkIndex,
      skipped: true,
      skipReason: `import status is ${importFile.status}`,
    };
  }

  if (importFile.status === "paused") {
    return {
      chunkIndex: input.payload.chunkIndex,
      skipped: true,
      skipReason: "import is paused",
    };
  }

  const pipeline = readImportPipelineMetadata(importFile.metadata);
  if (isChunkCompleted(pipeline, input.payload.chunkIndex)) {
    await input.job?.updateProgress(
      chunkProgressPercent(readImportPipelineMetadata(importFile.metadata))
    );
    return {
      chunkIndex: input.payload.chunkIndex,
      skipped: true,
      skipReason: "chunk already recorded in import_pipeline.chunk_results",
    };
  }

  const chunkRows = (await downloadCreatorImportChunk({
    supabase: input.supabase,
    importFileId: input.importFileId,
    chunkIndex: input.payload.chunkIndex,
  })) as ParsedCreatorRow[];

  const { log } = createImportLogContext();

  const counters = await upsertImportedCreators(chunkRows, {
    supabase: input.supabase,
    importFileId: input.importFileId,
    sourceName: input.payload.sourceName,
    uploadedBy: input.payload.uploadedBy,
    enableOpenGraphAvatarFallback: input.payload.fileType === "pdf",
    log,
  });

  const { alreadyCompleted, pipeline: nextPipeline } = await recordChunkProgress(
    input.supabase,
    {
      importFileId: input.importFileId,
      chunkIndex: input.payload.chunkIndex,
      result: counters,
    }
  );

  const progress = chunkProgressPercent(nextPipeline);
  await input.job?.updateProgress(progress);

  log(
    "info",
    `Chunk ${input.payload.chunkIndex + 1}/${input.payload.totalChunks} complete — imported ${counters.imported}, updated ${counters.updated}, duplicate ${counters.duplicate}, failed ${counters.failed}`
  );

  return {
    chunkIndex: input.payload.chunkIndex,
    skipped: alreadyCompleted,
    ...(alreadyCompleted
      ? { skipReason: "chunk progress was recorded by a concurrent worker" }
      : {}),
  };
}

/** Parent flow job — aggregate counters, cleanup storage, mark import completed. */
export async function finalizeCreatorImportFile(
  input: ProcessImportFileInput & {
    payload: CreatorImportFinalizeJobPayload;
  }
): Promise<ImportProcessingLog> {
  const startedAt = Date.now();
  const { entries, errors, log } = createImportLogContext();

  const { data: importFile, error: loadError } = await input.supabase
    .from("creator_import_files")
    .select("*")
    .eq("id", input.importFileId)
    .single();

  if (loadError || !importFile) {
    throw new Error(loadError?.message ?? "Import file not found.");
  }

  if (importFile.status === "completed" || importFile.status === "failed") {
    const existingLog = importFile.processing_log as ImportProcessingLog | null;
    log(
      "info",
      `Finalize skipped — import already ${importFile.status}${
        importFile.error_message ? ` (${importFile.error_message})` : ""
      }.`
    );
    return {
      ...(existingLog ?? {
        parser: input.payload.parser,
        file_type: importFile.file_type,
        duration_ms: 0,
        entries: [],
      }),
      finalize_skipped: true,
      finalize_skip_reason: `import status is ${importFile.status}`,
      entries: [
        ...(existingLog?.entries ?? []),
        ...entries,
      ],
    };
  }

  if (importFile.status === "paused") {
    log("info", "Import is paused; skipping finalize.");
    return {
      parser: input.payload.parser,
      file_type: importFile.file_type,
      duration_ms: 0,
      entries: [{ at: new Date().toISOString(), level: "info", message: "Finalize skipped — import paused." }],
    };
  }

  const pipeline = readImportPipelineMetadata(importFile.metadata);
  const counters = aggregateChunkCounters(pipeline);

  log(
    "info",
    `Finalizing import — imported ${counters.imported}, updated ${counters.updated}, skipped ${counters.skipped}, duplicate ${counters.duplicate}, failed ${counters.failed}, avatars ${counters.avatars_imported}, missing avatars ${counters.missing_avatars}`
  );

  let storagePathAfterProcessing: string | null = importFile.storage_path;
  const metadataAfterProcessing = mergeImportPipelineMetadata(importFile.metadata, {
    finalized_at: new Date().toISOString(),
  });

  const sourceStoragePath =
    pipeline.source_storage_path ?? importFile.storage_path ?? null;

  if (sourceStoragePath) {
    try {
      await removeCreatorImportObject({
        supabase: input.supabase,
        storagePath: sourceStoragePath,
      });
      storagePathAfterProcessing = null;
      metadataAfterProcessing.storage_removed_at = new Date().toISOString();
      log("info", "Source file removed from storage after processing");
    } catch (removeError) {
      const removeMessage =
        removeError instanceof Error
          ? removeError.message
          : "Could not remove source file from storage";
      log("warn", removeMessage);
    }
  }

  try {
    await removeCreatorImportChunks({
      supabase: input.supabase,
      importFileId: input.importFileId,
      totalChunks: input.payload.totalChunks,
    });
    log("info", "Temporary chunk payloads removed from storage");
  } catch (removeError) {
    const removeMessage =
      removeError instanceof Error
        ? removeError.message
        : "Could not remove chunk payloads from storage";
    log("warn", removeMessage);
  }

  const priorLog =
    importFile.processing_log &&
    typeof importFile.processing_log === "object" &&
    !Array.isArray(importFile.processing_log)
      ? (importFile.processing_log as ImportProcessingLog)
      : null;

  const processingLog: ImportProcessingLog = {
    parser: input.payload.parser,
    file_type: importFile.file_type,
    duration_ms: Date.now() - startedAt,
    errors,
    summary: {
      ...counters,
      errors: counters.failed,
      queue_status: "completed",
    },
    entries: [...(priorLog?.entries ?? []), ...entries],
  };

  const { data: finalizedRow } = await input.supabase
    .from("creator_import_files")
    .update({
      status: "completed",
      storage_path: storagePathAfterProcessing,
      metadata: metadataAfterProcessing,
      total_creators: counters.total,
      imported_creators: counters.imported,
      updated_creators: counters.updated,
      duplicate_creators: counters.duplicate,
      failed_creators: counters.failed,
      parser_strategy: input.payload.parser,
      extracted_text_length: input.payload.extractedTextLength,
      extraction_method: input.payload.extractionMethod,
      warning_message: input.payload.warning,
      processing_completed_at: new Date().toISOString(),
      processing_log: processingLog,
    })
    .eq("id", input.importFileId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();

  if (!finalizedRow) {
    log("info", "Import was cancelled or already finalized; skipping completion update.");
    return processingLog;
  }

  await insertAuditLog(input.supabase, {
    action: "update",
    entity_type: "creator_import_file",
    entity_id: input.importFileId,
    actor_id: importFile.uploaded_by,
    metadata: {
      operation: "discovery_import_completed",
      parser: input.payload.parser,
      total_creators: counters.total,
      imported_creators: counters.imported,
      updated_creators: counters.updated,
      duplicate_creators: counters.duplicate,
      failed_creators: counters.failed,
      total_chunks: input.payload.totalChunks,
    },
  });

  return processingLog;
}

/** @deprecated Use prepareCreatorImportFile — kept for tests and backward compatibility. */
export async function processCreatorImportFile(
  input: ProcessImportFileInput
): Promise<ImportProcessingLog> {
  await prepareCreatorImportFile(input);
  return {
    entries: [{ at: new Date().toISOString(), level: "info", message: "Import queued in chunks." }],
  };
}

async function attachPdfImportAvatars(input: {
  buffer: Buffer;
  rows: ParsedCreatorRow[];
  importFileId: string;
  supabase: ProcessImportFileInput["supabase"];
  log: (level: ImportProcessingLogEntry["level"], message: string) => void;
}): Promise<void> {
  const targets = input.rows.filter((row) => !row.profile_picture_url?.trim());
  if (targets.length === 0) return;

  let avatarBuffers: Map<string, { buffer: Buffer; contentType: string }>;
  try {
    avatarBuffers = await extractPdfCreatorAvatarBuffers(input.buffer, targets);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF avatar extraction failed";
    input.log("warn", `[import] avatar extraction failed: ${message}`);
    return;
  }

  for (const row of targets) {
    const key = row.username.toLowerCase();
    const extracted = avatarBuffers.get(key);
    logPdfAvatarExtraction(row.username, Boolean(extracted));
    if (!extracted) continue;

    input.log(
      "info",
      `[import] avatar extracted @${row.username} (${row.platform}) bytes=${extracted.buffer.length}`
    );

    try {
      const publicUrl = await uploadImportCreatorAvatar({
        supabase: input.supabase,
        importFileId: input.importFileId,
        platform: row.platform,
        username: row.username,
        buffer: extracted.buffer,
        contentType: extracted.contentType,
      });
      row.profile_picture_url = publicUrl;
      row.profile_avatar_source = "uploaded";
      input.log("info", `[import] avatar uploaded @${row.username} url=${publicUrl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Avatar upload failed";
      input.log("warn", `[import] avatar upload failed @${row.username}: ${message}`);
    }
  }
}

export { splitCreatorRows };
