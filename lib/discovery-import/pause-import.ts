import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import { cancelCreatorImportJobs } from "./cancel-import";
import { mergeImportPipelineMetadata, readImportPipelineMetadata } from "./chunk-progress";
import {
  creatorImportPausedStatusMigrationHint,
  isCreatorImportPausedStatusConstraintError,
  PAUSABLE_CREATOR_IMPORT_STATUSES,
} from "./constants";

export { PAUSABLE_CREATOR_IMPORT_STATUSES };

export type PauseCreatorImportFileResult = {
  ok: boolean;
  message: string;
  jobsRemoved?: number;
};

export async function pauseCreatorImportFile(
  supabase: SupabaseClient<Database>,
  importFileId: string,
  actorId: string | null
): Promise<PauseCreatorImportFileResult> {
  const { data: importFile, error: loadError } = await supabase
    .from("creator_import_files")
    .select("id, status, metadata, uploaded_by")
    .eq("id", importFileId)
    .single();

  if (loadError || !importFile) {
    return { ok: false, message: loadError?.message ?? "Import file not found." };
  }

  if (
    !PAUSABLE_CREATOR_IMPORT_STATUSES.includes(
      importFile.status as (typeof PAUSABLE_CREATOR_IMPORT_STATUSES)[number]
    )
  ) {
    return {
      ok: false,
      message: `Import cannot be paused while status is "${importFile.status}".`,
    };
  }

  const pipeline = readImportPipelineMetadata(importFile.metadata);
  const jobsResult = await cancelCreatorImportJobs(importFileId, {
    totalChunks: pipeline.total_chunks,
  });

  const pausedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("creator_import_files")
    .update({
      status: "paused",
      metadata: mergeImportPipelineMetadata(importFile.metadata, {
        paused_at: pausedAt,
        paused_from_status: importFile.status,
      }),
    })
    .eq("id", importFileId)
    .in("status", [...PAUSABLE_CREATOR_IMPORT_STATUSES])
    .select("id")
    .maybeSingle();

  if (updateError) {
    if (isCreatorImportPausedStatusConstraintError(updateError.message)) {
      return {
        ok: false,
        message: `Pause requires a database update. ${creatorImportPausedStatusMigrationHint()}`,
      };
    }
    return { ok: false, message: updateError.message };
  }

  if (!updated) {
    return {
      ok: false,
      message: "Import is no longer in a pausable state.",
    };
  }

  await insertAuditLog(supabase, {
    action: "update",
    entity_type: "creator_import_file",
    entity_id: importFileId,
    actor_id: actorId ?? importFile.uploaded_by,
    metadata: {
      operation: "discovery_import_paused",
      paused_from_status: importFile.status,
      jobs_removed: jobsResult.removed,
    },
  });

  return {
    ok: true,
    message: "Import processing paused.",
    jobsRemoved: jobsResult.removed,
  };
}
