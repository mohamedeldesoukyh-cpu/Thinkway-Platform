/**
 * Canonical invoice_status values (public.invoice_status enum).
 * Note: deliverable/campaign/payment enums may use "cancelled" — not invoice_status.
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

/** Statuses shown in finance / billing registers (excludes void). */
export const REGISTER_INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
] as const;

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

/** Invoice contributes to active invoiced totals and line-item rollups. */
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
