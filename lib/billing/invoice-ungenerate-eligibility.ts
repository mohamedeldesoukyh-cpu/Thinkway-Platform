export type InvoiceUngenerateEligibilityInput = {
  status: string;
  regeneration_status?: string | null;
  is_operational_locked?: boolean | null;
};

const FINANCE_FINALIZED_STATUSES = new Set(["sent", "partial", "paid"]);

export function isInvoiceUngenerateEligible(
  input: InvoiceUngenerateEligibilityInput
): boolean {
  if (input.status === "paid" || input.status === "void") return false;
  if (FINANCE_FINALIZED_STATUSES.has(input.status)) return false;
  if (input.is_operational_locked) return false;
  if (input.regeneration_status === "pending_regeneration") return false;
  return true;
}

export function invoiceUngenerateIneligibleReason(
  input: InvoiceUngenerateEligibilityInput
): string | null {
  if (input.status === "paid") return "Paid invoices cannot be un-generated.";
  if (input.status === "void") return "Void invoices cannot be un-generated.";
  if (FINANCE_FINALIZED_STATUSES.has(input.status)) {
    return "Sent or partially paid invoices cannot be un-generated.";
  }
  if (input.is_operational_locked) {
    return "Invoice is locked by finance finalization or period close.";
  }
  if (input.regeneration_status === "pending_regeneration") {
    return "Invoice is already pending regeneration.";
  }
  return null;
}
