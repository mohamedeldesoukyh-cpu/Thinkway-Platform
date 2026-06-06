import { blocksSourceDocumentActions, isActiveAdjustmentStatus } from "@/lib/finance/status/adjustment-status";
import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status/invoice-status";

export type LinkedAdjustmentSummary = {
  id: string;
  document_number: string;
  status: string;
  amount_after_vat: number;
};

/** Rule 1 — invoice locked when active CN/DN exists. */
export function isInvoiceLockedByAdjustments(
  adjustments: LinkedAdjustmentSummary[]
): boolean {
  return adjustments.some((row) => blocksSourceDocumentActions(row.status));
}

export function canCancelInvoice(input: {
  invoice_status: string;
  regeneration_status?: string | null;
  amount_paid: number;
  is_posted_to_erp: boolean;
  linked_adjustments: LinkedAdjustmentSummary[];
}): { allowed: boolean; reason?: string } {
  if (!isActiveInvoiceForFinancialTotals({
    status: input.invoice_status,
    regeneration_status: input.regeneration_status,
  })) {
    return { allowed: false, reason: "Invoice is not in an active state." };
  }
  if (input.amount_paid > 0) {
    return { allowed: false, reason: "Invoice has collected payments." };
  }
  if (input.is_posted_to_erp) {
    return { allowed: false, reason: "Invoice is posted to ERP. Unpost first." };
  }
  if (isInvoiceLockedByAdjustments(input.linked_adjustments)) {
    return {
      allowed: false,
      reason: "Active credit/debit notes are linked. Cancel or unpost them first.",
    };
  }
  return { allowed: true };
}

export function canUnpostInvoice(input: {
  is_posted_to_erp: boolean;
  linked_adjustments: LinkedAdjustmentSummary[];
}): { allowed: boolean; reason?: string } {
  if (!input.is_posted_to_erp) {
    return { allowed: false, reason: "Invoice is not posted." };
  }
  if (isInvoiceLockedByAdjustments(input.linked_adjustments)) {
    return {
      allowed: false,
      reason: "Active CN/DN linked. Resolve adjustments before unposting invoice.",
    };
  }
  return { allowed: true };
}

export function canUnpostAdjustment(status: string): { allowed: boolean; reason?: string } {
  if (status !== "posted") {
    return { allowed: false, reason: "Only posted adjustments can be unposted." };
  }
  return { allowed: true };
}

export function canCancelAdjustment(status: string): { allowed: boolean; reason?: string } {
  if (status === "cancelled" || status === "void") {
    return { allowed: false, reason: "Adjustment is already cancelled or void." };
  }
  return { allowed: true };
}

export function canReopenCancelledAdjustment(status: string): { allowed: boolean; reason?: string } {
  if (status !== "cancelled") {
    return { allowed: false, reason: "Only cancelled adjustments can be reopened." };
  }
  return { allowed: true };
}

export function adjustmentUnpostResultStatus(): "pending_repost" {
  return "pending_repost";
}

export function countActiveAdjustments(adjustments: LinkedAdjustmentSummary[]): number {
  return adjustments.filter((row) => isActiveAdjustmentStatus(row.status)).length;
}
