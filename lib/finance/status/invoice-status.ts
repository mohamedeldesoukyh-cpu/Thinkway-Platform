/**
 * Canonical invoice_status values (public.invoice_status enum).
 * Deliverable/campaign/payment enums may use "cancelled" — not invoice_status.
 */
export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partial"
  | "paid"
  | "overdue"
  | "void";

export type InvoiceRegenerationStatus =
  | "active"
  | "pending_regeneration"
  | "regenerated";

export const REGISTER_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
] as const;

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
};

const REGISTER_STATUS_SET = new Set<string>(REGISTER_INVOICE_STATUSES);

export function isKnownInvoiceStatus(value: string): value is InvoiceStatus {
  return (
    value === "draft" ||
    value === "sent" ||
    value === "partial" ||
    value === "paid" ||
    value === "overdue" ||
    value === "void"
  );
}

export function isVoidInvoiceStatus(status: string): boolean {
  return status === "void";
}

export function isActiveInvoiceForFinancialTotals(input: {
  status: string;
  regeneration_status?: string | null;
}): boolean {
  if (!isKnownInvoiceStatus(input.status)) return false;
  if (input.status === "void") return false;
  if (input.regeneration_status === "regenerated") return false;
  if (
    input.regeneration_status === "pending_regeneration" &&
    input.status !== "draft"
  ) {
    return false;
  }
  return true;
}

export function isRegisterInvoiceStatus(status: string): boolean {
  return REGISTER_STATUS_SET.has(status);
}

export function isAppendableInvoiceStatus(status: string): boolean {
  return status === "draft" || status === "sent" || status === "partial";
}

/** Register display labels for operational draft invoices (DB status stays `draft`). */
export function getInvoiceRegisterStatusLabel(input: {
  status: string;
  regeneration_status?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  if (input.status === "void" && input.metadata?.campaign_cancelled === true) {
    return "Cancelled";
  }

  if (input.status === "draft") {
    if (input.regeneration_status === "pending_regeneration") {
      return "Pending";
    }
    return "Issued";
  }

  if (isKnownInvoiceStatus(input.status)) {
    return INVOICE_STATUS_LABELS[input.status];
  }

  return input.status;
}
