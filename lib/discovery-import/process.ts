import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import {
  enrichImportedPlatformAccount,
  queueImportedCreatorEnrichment,
} from "./enrichment";
import { parseImportFile } from "./parsers";
import { downloadCreatorImportFile } from "./storage";
import type { ImportProcessingLog, ImportProcessingLogEntry } from "./types";
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

    const enrichmentQueued = await queueImportedCreatorEnrichment(
      input.supabase,
      counters.enrichmentAccountIds,
      input.importFileId
    );

    log(
      "info",
      `Upsert complete — imported ${counters.imported}, updated ${counters.updated}, duplicate ${counters.duplicate}, failed ${counters.failed}`
    );
    log("info", `Queued ${enrichmentQueued} enrichment job(s)`);

    const processingLog: ImportProcessingLog = {
      parser: parsed.parser,
      file_type: importFile.file_type,
      duration_ms: Date.now() - startedAt,
      enrichment_queued: enrichmentQueued,
      errors,
      entries,
    };

    await input.supabase
      .from("creator_import_files")
      .update({
        status: "completed",
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
