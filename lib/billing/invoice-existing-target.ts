import { isInvoiceAppendable } from "@/lib/billing/campaign-billing-queue";

export type InvoiceExistingTargetInput = {
  status: string;
  regeneration_status: string | null;
  is_operational_locked?: boolean | null;
  currency: string;
  client_id: string;
  campaign_header_id: string | null;
  target_currency: string;
  target_client_id: string;
  target_campaign_id: string;
};

/** Pending regeneration only while the invoice is still a live draft — never after void. */
export function isLivePendingRegenerationInvoice(input: {
  status?: string | null;
  regeneration_status?: string | null;
}): boolean {
  if (!input.status || input.status === "void") return false;
  return input.regeneration_status === "pending_regeneration";
}

export function findLivePendingRegenerationInvoice<
  T extends { status?: string | null; regeneration_status?: string | null },
>(invoices: T[]): T | undefined {
  return invoices.find((invoice) => isLivePendingRegenerationInvoice(invoice));
}

/** Ungenerated invoice that can be rebuilt in place (same invoice number). */
export function isInvoiceRegeneratableTarget(input: InvoiceExistingTargetInput): boolean {
  if (input.client_id !== input.target_client_id) return false;
  if (input.currency !== input.target_currency) return false;
  if (input.campaign_header_id && input.campaign_header_id !== input.target_campaign_id) {
    return false;
  }
  if (input.status === "void" || input.status === "paid") return false;
  return isLivePendingRegenerationInvoice(input);
}

/** Open invoice to append to, or pending invoice to regenerate. */
export function isInvoiceExistingTarget(input: InvoiceExistingTargetInput): boolean {
  return isInvoiceAppendable(input) || isInvoiceRegeneratableTarget(input);
}

export function existingInvoiceTargetMode(input: {
  status?: string | null;
  regeneration_status?: string | null;
}): "regenerate" | "append" {
  return isLivePendingRegenerationInvoice(input) ? "regenerate" : "append";
}

/**
 * Cancel the old ungenerated invoice when a replacement invoice covers the same lines.
 * No line items → treat as campaign-level pending (ungenerate leftover).
 */
export function pendingInvoiceOverlapsReplacement(input: {
  pendingInvoiceId: string;
  replacementInvoiceId: string;
  pendingLineIds: string[];
  touchedLineIds: string[];
}): boolean {
  if (input.pendingInvoiceId === input.replacementInvoiceId) return false;
  if (input.pendingLineIds.length === 0) return input.touchedLineIds.length > 0;
  const touched = new Set(input.touchedLineIds);
  return input.pendingLineIds.some((lineId) => touched.has(lineId));
}
