export type FinancePostingBatchStatus = "draft" | "posted" | "reversed" | "failed";

export type ErpSyncStatus =
  | "queued"
  | "sent"
  | "acknowledged"
  | "failed"
  | "cancelled";

export const POSTING_BATCH_STATUS_LABELS: Record<FinancePostingBatchStatus, string> = {
  draft: "Draft",
  posted: "Posted",
  reversed: "Reversed",
  failed: "Failed",
};

export const ERP_SYNC_STATUS_LABELS: Record<ErpSyncStatus, string> = {
  queued: "Queued",
  sent: "Sent",
  acknowledged: "Acknowledged",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function isPostingBatchOpen(status: string): boolean {
  return status === "draft";
}

export function canReversePostingBatch(status: string): boolean {
  return status === "posted";
}
