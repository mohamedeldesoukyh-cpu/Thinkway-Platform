import type { ConnectionOptions } from "bullmq";
import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

import { readImportPipelineMetadata } from "./chunk-progress";
import {
  CANCELLABLE_CREATOR_IMPORT_STATUSES,
  CREATOR_IMPORT_CANCELLED_MESSAGE,
  CREATOR_IMPORT_QUEUES,
} from "./constants";
import { getConnectionOptions } from "./queue-connection";

export {
  CANCELLABLE_CREATOR_IMPORT_STATUSES,
  CREATOR_IMPORT_CANCELLED_MESSAGE,
};

export type CancelCreatorImportJobsResult = {
  removed: number;
};

async function removeImportJob(
  queueName: string,
  jobId: string,
  connection: ConnectionOptions
): Promise<boolean> {
  const { Queue } = await import("bullmq");
  const queue = new Queue(queueName, { connection });

  try {
    const job = await queue.getJob(jobId);
    if (!job) return false;

    const state = await job.getState();
    if (state === "active") {
      try {
        await job.discard();
      } catch {
        // Best-effort discard for active jobs.
      }
      // Do not remove active jobs — the worker still holds the lock and renews it.
      return false;
    }
    await job.remove();
    return true;
  } catch {
    return false;
  } finally {
    await queue.close().catch(() => {});
  }
}

async function removeImportJobsByImportFileId(
  queueName: string,
  importFileId: string,
  connection: ConnectionOptions
): Promise<number> {
  const { Queue } = await import("bullmq");
  const queue = new Queue(queueName, { connection });
  let removed = 0;

  try {
    const jobs = await queue.getJobs(["waiting", "delayed", "active", "paused"], 0, 499);
    for (const job of jobs) {
      const data = job.data as { importFileId?: string };
      if (data.importFileId !== importFileId) continue;

      try {
        const state = await job.getState();
        if (state === "active") {
          try {
            await job.discard();
          } catch {
            // Best-effort discard for active jobs.
          }
          continue;
        }
        await job.remove();
        removed += 1;
      } catch {
        // Best-effort per job.
      }
    }
  } catch {
    return removed;
  } finally {
    await queue.close().catch(() => {});
  }

  return removed;
}

/** Remove pending/active BullMQ jobs tied to an import file. */
export async function cancelCreatorImportJobs(
  importFileId: string,
  options?: { totalChunks?: number }
): Promise<CancelCreatorImportJobsResult> {
  const connection = getConnectionOptions();
  if (!connection) {
    return { removed: 0 };
  }

  let removed = 0;

  const knownJobIds = [
    `creator-import-${importFileId}`,
    `creator-import-finalize-${importFileId}`,
  ];

  const totalChunks = options?.totalChunks ?? 0;
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    knownJobIds.push(`creator-import-chunk-${importFileId}-${chunkIndex}`);
  }

  for (const queueName of Object.values(CREATOR_IMPORT_QUEUES)) {
    for (const jobId of knownJobIds) {
      if (queueName === CREATOR_IMPORT_QUEUES.enrich) continue;
      const didRemove = await removeImportJob(queueName, jobId, connection);
      if (didRemove) removed += 1;
    }

    removed += await removeImportJobsByImportFileId(
      queueName,
      importFileId,
      connection
    );
  }

  return { removed };
}

export type CancelCreatorImportFileResult = {
  ok: boolean;
  message: string;
  jobsRemoved?: number;
};

export async function cancelCreatorImportFile(
  supabase: SupabaseClient<Database>,
  importFileId: string,
  actorId: string | null
): Promise<CancelCreatorImportFileResult> {
  const { data: importFile, error: loadError } = await supabase
    .from("creator_import_files")
    .select("id, status, metadata, uploaded_by")
    .eq("id", importFileId)
    .single();

  if (loadError || !importFile) {
    return { ok: false, message: loadError?.message ?? "Import file not found." };
  }

  if (
    !CANCELLABLE_CREATOR_IMPORT_STATUSES.includes(
      importFile.status as (typeof CANCELLABLE_CREATOR_IMPORT_STATUSES)[number]
    )
  ) {
    return {
      ok: false,
      message: `Import cannot be cancelled while status is "${importFile.status}".`,
    };
  }

  const pipeline = readImportPipelineMetadata(importFile.metadata);
  const jobsResult = await cancelCreatorImportJobs(importFileId, {
    totalChunks: pipeline.total_chunks,
  });

  const cancelledAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("creator_import_files")
    .update({
      status: "failed",
      error_message: CREATOR_IMPORT_CANCELLED_MESSAGE,
      processing_completed_at: cancelledAt,
    })
    .eq("id", importFileId)
    .in("status", [...CANCELLABLE_CREATOR_IMPORT_STATUSES])
    .select("id")
    .maybeSingle();

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  if (!updated) {
    return {
      ok: false,
      message: "Import is no longer in a cancellable state.",
    };
  }

  await insertAuditLog(supabase, {
    action: "update",
    entity_type: "creator_import_file",
    entity_id: importFileId,
    actor_id: actorId ?? importFile.uploaded_by,
    metadata: {
      operation: "discovery_import_cancelled",
      jobs_removed: jobsResult.removed,
    },
  });

  return {
    ok: true,
    message: "Import processing stopped.",
    jobsRemoved: jobsResult.removed,
  };
}
