import type { SupabaseClient } from "@supabase/supabase-js";

import { assignmentStatusFromBilling } from "@/lib/campaigns/line-assignment";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { parseInvoiceBillingMode } from "@/lib/billing/invoice-validation-context";
import { unlockDeliverablesForInvoice } from "@/lib/billing/sync-deliverable-billing";

export type BillingMutationResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  invoiceId?: string;
  campaignId?: string;
};

export function emptyToNull(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim();
}

export function buildInvoiceCreateSuccessMessage(input: {
  invoiceMode: ReturnType<typeof parseInvoiceBillingMode>;
  documentNumber: string;
  invoicedRowCount: number;
  requestedLineIds: string[];
  touchedLineIds: string[];
}): string {
  const displayNumber = formatDocumentNumberForDisplay(input.documentNumber);
  const actionLabel = input.invoiceMode === "append" ? "Appended to" : "Created";
  const rowLabel = input.invoicedRowCount === 1 ? "row" : "rows";
  let message = `${actionLabel} invoice ${displayNumber} (${input.invoicedRowCount} ${rowLabel}).`;

  const touched = new Set(input.touchedLineIds);
  const skippedLineCount = input.requestedLineIds.filter((lineId) => !touched.has(lineId)).length;
  if (skippedLineCount > 0) {
    message += ` ${skippedLineCount} selected assignment${skippedLineCount === 1 ? "" : "s"} still ha${skippedLineCount === 1 ? "s" : "ve"} billable rows remaining.`;
  }

  return message;
}

export function lineBillingPatch(billingStatus: string) {
  const assignmentStatus = assignmentStatusFromBilling(billingStatus);
  return assignmentStatus
    ? { billing_status: billingStatus, assignment_status: assignmentStatus }
    : { billing_status: billingStatus };
}

export async function rollbackNewInvoiceDraft(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  await unlockDeliverablesForInvoice(supabase, invoiceId);
  await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
  await supabase.from("invoices").delete().eq("id", invoiceId);
}
