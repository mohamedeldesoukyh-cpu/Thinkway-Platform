/** CN/DN lifecycle (public.finance_adjustment_status). */
export type FinanceAdjustmentStatus =
  | "draft"
  | "approved"
  | "posted"
  | "cancelled"
  | "void"
  | "pending_repost";

export const FINANCE_ADJUSTMENT_STATUS_LABELS: Record<FinanceAdjustmentStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  posted: "Posted",
  cancelled: "Cancelled",
  void: "Void",
  pending_repost: "Pending repost",
};

export const ACTIVE_ADJUSTMENT_STATUSES: readonly FinanceAdjustmentStatus[] = [
  "draft",
  "approved",
  "posted",
  "pending_repost",
] as const;

const ACTIVE_SET = new Set<string>(ACTIVE_ADJUSTMENT_STATUSES);

export function isActiveAdjustmentStatus(status: string): boolean {
  return ACTIVE_SET.has(status);
}

export function isPostedAdjustmentStatus(status: string): boolean {
  return status === "posted";
}

export function blocksSourceDocumentActions(status: string): boolean {
  return status === "approved" || status === "posted" || status === "pending_repost";
}
