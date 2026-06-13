import type { LinkedAdjustmentSummary } from "@/lib/finance/document-controls";
import {
  canCancelAdjustment,
  canReopenCancelledAdjustment,
  canUnpostAdjustment,
  isInvoiceLockedByAdjustments,
} from "@/lib/finance/document-controls";
import {
  isActiveAdjustmentStatus,
  isPostedAdjustmentStatus,
} from "@/lib/finance/status/adjustment-status";
import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status/invoice-status";

export type IntegrityViolation = { allowed: false; reason: string };
export type IntegrityOk = { allowed: true };
export type IntegrityResult = IntegrityViolation | IntegrityOk;

export function guardNegativeInvoiceRemainder(input: {
  invoice_total: number;
  amount_paid: number;
  adjustment_total: number;
}): IntegrityResult {
  const remainder = input.invoice_total - input.amount_paid - input.adjustment_total;
  if (remainder < -0.01) {
    return { allowed: false, reason: "Invoice remainder cannot be negative." };
  }
  return { allowed: true };
}

export function guardDuplicatePosting(input: {
  already_posted: boolean;
  batch_status?: string;
}): IntegrityResult {
  if (input.already_posted) {
    return { allowed: false, reason: "Document is already posted." };
  }
  if (input.batch_status === "posted") {
    return { allowed: false, reason: "Posting batch is already posted." };
  }
  return { allowed: true };
}

export function guardEditPostedAmounts(status: string): IntegrityResult {
  if (isPostedAdjustmentStatus(status)) {
    return { allowed: false, reason: "Posted financial values are immutable." };
  }
  return { allowed: true };
}

export function guardFinanceDocDeletion(): IntegrityResult {
  return { allowed: false, reason: "Finance documents cannot be deleted." };
}

export function guardVatEditAfterPosting(input: {
  status: string;
  vat_changed: boolean;
}): IntegrityResult {
  if (input.vat_changed && isPostedAdjustmentStatus(input.status)) {
    return { allowed: false, reason: "VAT cannot be edited after posting." };
  }
  return { allowed: true };
}

export function guardPostCancelledDoc(status: string): IntegrityResult {
  if (status === "cancelled" || status === "void") {
    return { allowed: false, reason: "Cancelled documents cannot be posted." };
  }
  return { allowed: true };
}

export function guardDuplicateCnPosting(input: {
  status: string;
  posting_batch_id: string | null;
}): IntegrityResult {
  if (isPostedAdjustmentStatus(input.status) && input.posting_batch_id) {
    return { allowed: false, reason: "Adjustment is already in a posted batch." };
  }
  return { allowed: true };
}

export function guardUnpostInvoiceWithAdjustments(
  adjustments: LinkedAdjustmentSummary[]
): IntegrityResult {
  if (isInvoiceLockedByAdjustments(adjustments)) {
    return {
      allowed: false,
      reason: "Cannot unpost invoice while active CN/DN exist.",
    };
  }
  return { allowed: true };
}

export function guardApproveAdjustment(status: string): IntegrityResult {
  if (status !== "draft" && status !== "pending_repost") {
    return { allowed: false, reason: "Only draft or reopened adjustments can be approved." };
  }
  return { allowed: true };
}

export function guardPostAdjustment(status: string): IntegrityResult {
  if (status !== "approved") {
    return { allowed: false, reason: "Only approved adjustments can be posted." };
  }
  return guardPostCancelledDoc(status);
}

export function guardCancelAdjustment(status: string): IntegrityResult {
  const check = canCancelAdjustment(status);
  if (!check.allowed) return { allowed: false, reason: check.reason ?? "Cannot cancel." };
  if (isPostedAdjustmentStatus(status)) {
    return { allowed: false, reason: "Posted adjustments must be unposted before cancellation." };
  }
  return { allowed: true };
}

export function guardReopenAdjustment(status: string): IntegrityResult {
  const check = canReopenCancelledAdjustment(status);
  return check.allowed
    ? { allowed: true }
    : { allowed: false, reason: check.reason ?? "Cannot reopen." };
}

export function guardUnpostAdjustment(status: string): IntegrityResult {
  const check = canUnpostAdjustment(status);
  return check.allowed
    ? { allowed: true }
    : { allowed: false, reason: check.reason ?? "Cannot unpost." };
}

export function guardVoidInvoice(input: {
  status: string;
  regeneration_status?: string | null;
  amount_paid: number;
  linked_adjustments: LinkedAdjustmentSummary[];
}): IntegrityResult {
  if (!isActiveInvoiceForFinancialTotals(input)) {
    return { allowed: false, reason: "Invoice is not in an active state." };
  }
  if (input.amount_paid > 0) {
    return { allowed: false, reason: "Cannot void invoice with collected payments." };
  }
  if (isInvoiceLockedByAdjustments(input.linked_adjustments)) {
    return {
      allowed: false,
      reason: "Resolve active CN/DN before voiding invoice.",
    };
  }
  return { allowed: true };
}

export function guardCampaignCancellation(input: {
  period_lock?: { year: number; month: number; status: string } | null;
  invoices: {
    status: string;
    regeneration_status?: string | null;
    amount_paid?: number;
  }[];
}): IntegrityResult {
  if (input.period_lock && input.period_lock.status !== "open") {
    const label = `${input.period_lock.year}-${String(input.period_lock.month).padStart(2, "0")}`;
    if (input.period_lock.status === "fully_locked") {
      return {
        allowed: false,
        reason: `Campaign cannot be cancelled — accounting period ${label} is fully locked.`,
      };
    }
    return {
      allowed: false,
      reason: `Campaign cannot be cancelled — accounting period ${label} is locked.`,
    };
  }

  const blockingPaid = input.invoices.filter(
    (inv) =>
      isActiveInvoiceForFinancialTotals(inv) && Number(inv.amount_paid ?? 0) > 0
  );
  if (blockingPaid.length > 0) {
    return {
      allowed: false,
      reason: "Campaign cannot be cancelled while invoices have collected payments.",
    };
  }
  return { allowed: true };
}

export function countBlockingAdjustments(adjustments: LinkedAdjustmentSummary[]): number {
  return adjustments.filter((a) => isActiveAdjustmentStatus(a.status)).length;
}
