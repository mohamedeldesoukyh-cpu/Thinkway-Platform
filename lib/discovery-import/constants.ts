/** Maximum creators processed by a single BullMQ import job. */
export const CREATOR_IMPORT_CHUNK_SIZE = 100;

/** Parallel client uploads when dropping multiple import files. */
export const CREATOR_IMPORT_UPLOAD_CONCURRENCY = 4;

/** BullMQ worker concurrency for prepare/finalize import jobs (one job per file). */
export const CREATOR_IMPORT_WORKER_CONCURRENCY = 3;

/** Worker lock for prepare/finalize jobs (large file parse + chunk upload). */
export const CREATOR_IMPORT_PREPARE_LOCK_DURATION_MS = 180_000;

/** Worker lock for chunk jobs (100 creators + PDF avatar extraction). */
export const CREATOR_IMPORT_CHUNK_LOCK_DURATION_MS = 300_000;

export const CREATOR_IMPORT_PAUSED_STATUS_MIGRATION =
  "20260630160000_creator_import_paused_status.sql";

export function creatorImportPausedStatusMigrationHint(): string {
  return "Apply the paused-status migration with: npx supabase db push";
}

export function isCreatorImportPausedStatusConstraintError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("creator_import_files_status_check") ||
    (lower.includes("check constraint") && lower.includes("paused"))
  );
}

export const CREATOR_IMPORT_QUEUES = {
  import: "creator-import",
  chunk: "creator-import-chunk",
  /** Legacy queue name — kept for cancel/cleanup of in-flight jobs from older imports. */
  enrich: "creator-import-enrich",
} as const;

export const CREATOR_IMPORT_CANCELLED_MESSAGE = "Cancelled by user";

export const CANCELLABLE_CREATOR_IMPORT_STATUSES = [
  "uploaded",
  "queued",
  "processing",
  "paused",
] as const;

export const PAUSABLE_CREATOR_IMPORT_STATUSES = [
  "uploaded",
  "queued",
  "processing",
] as const;

export const RESUMABLE_CREATOR_IMPORT_STATUSES = ["paused"] as const;

/** Cross-tab signal so Creator Search refetches after import jobs finish. */
export const CREATOR_IMPORT_COMPLETED_EVENT = "thinkway:creator-import-completed";

export function notifyCreatorImportCompleted(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CREATOR_IMPORT_COMPLETED_EVENT, String(Date.now()));
  window.dispatchEvent(new Event(CREATOR_IMPORT_COMPLETED_EVENT));
}
