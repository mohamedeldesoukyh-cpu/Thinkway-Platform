import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import { removeCreatorImportObject } from "@/lib/supabase/storage";
import type { Database } from "@/types/database";

import { parseImportFile } from "./parsers";
import {
  extractPdfCreatorAvatarBuffers,
  logPdfAvatarExtraction,
} from "./parsers/pdf-avatars";
import { uploadImportCreatorAvatar } from "./import-avatar-storage";
import { downloadCreatorImportFile } from "./storage";
import type { ImportProcessingLog, ImportProcessingLogEntry, ParsedCreatorRow } from "./types";
import { queueImportedCreatorAvatarEnrichment } from "./enrichment";
import { upsertImportedCreators } from "./upsert";

type ProcessImportFileInput = {
  supabase: SupabaseClient<Database>;
  importFileId: string;
};

export async function processCreatorImportFile(
  input: ProcessImportFileInput
): Promise<ImportProcessingLog> {
  const startedAt = Date.now();
  const entries: ImportProcessingLogEntry[] = [];
  const errors: NonNullable<ImportProcessingLog["errors"]> = [];

  const log = (level: ImportProcessingLogEntry["level"], message: string) => {
    entries.push({ at: new Date().toISOString(), level, message });
  };

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

  await input.supabase
    .from("creator_import_files")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("id", input.importFileId);

  log("info", `Processing ${importFile.filename} (${importFile.file_type})`);

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

    log("info", `Parser ${parsed.parser} extracted ${parsed.rows.length} creator row(s)`);
    if (parsed.diagnostics.warning) {
      log("warn", parsed.diagnostics.warning);
    }

    const counters = await upsertImportedCreators(parsed.rows, {
      supabase: input.supabase,
      importFileId: input.importFileId,
      sourceName: importFile.source_name,
      uploadedBy: importFile.uploaded_by,
      log,
    });

    log(
      "info",
      `Upsert complete — imported ${counters.imported}, updated ${counters.updated}, duplicate ${counters.duplicate}, failed ${counters.failed}`
    );

    const avatarEnrichmentQueued = await queueImportedCreatorAvatarEnrichment(
      counters.avatarEnrichmentAccountIds,
      input.importFileId
    );
    if (avatarEnrichmentQueued > 0) {
      log(
        "info",
        `[import] avatar enrichment queued: ${avatarEnrichmentQueued} account(s)`
      );
    }

    let storagePathAfterProcessing: string | null = importFile.storage_path;
    const metadataAfterProcessing: Record<string, unknown> =
      importFile.metadata &&
      typeof importFile.metadata === "object" &&
      !Array.isArray(importFile.metadata)
        ? { ...(importFile.metadata as Record<string, unknown>) }
        : {};

    if (importFile.storage_path) {
      try {
        await removeCreatorImportObject({
          supabase: input.supabase,
          storagePath: importFile.storage_path,
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

    const processingLog: ImportProcessingLog = {
      parser: parsed.parser,
      file_type: importFile.file_type,
      duration_ms: Date.now() - startedAt,
      enrichment_queued: avatarEnrichmentQueued,
      errors,
      entries,
    };

    await input.supabase
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
        parser_strategy: parsed.parser,
        extracted_text_length: parsed.diagnostics.extractedTextLength,
        extraction_method: parsed.diagnostics.extractionMethod,
        warning_message: parsed.diagnostics.warning,
        processing_completed_at: new Date().toISOString(),
        processing_log: processingLog,
      })
      .eq("id", input.importFileId);

    await insertAuditLog(input.supabase, {
      action: "update",
      entity_type: "creator_import_file",
      entity_id: input.importFileId,
      actor_id: importFile.uploaded_by,
      metadata: {
        operation: "discovery_import_completed",
        parser: parsed.parser,
        total_creators: counters.total,
        imported_creators: counters.imported,
        updated_creators: counters.updated,
        duplicate_creators: counters.duplicate,
        failed_creators: counters.failed,
      },
    });

    return processingLog;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import processing failed";
    log("error", message);
    errors.push({ message });

    const processingLog: ImportProcessingLog = {
      file_type: importFile.file_type,
      duration_ms: Date.now() - startedAt,
      errors,
      entries,
    };

    await input.supabase
      .from("creator_import_files")
      .update({
        status: "failed",
        error_message: message,
        processing_completed_at: new Date().toISOString(),
        processing_log: processingLog,
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
      },
    });

    throw error;
  }
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
      input.log(
        "info",
        `[import] avatar uploaded @${row.username} url=${publicUrl}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Avatar upload failed";
      input.log("warn", `[import] avatar upload failed @${row.username}: ${message}`);
    }
  }
}
