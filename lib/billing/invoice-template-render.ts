import type { InvoiceDocumentData } from "@/lib/billing/invoice-document-types";
import { buildInvoiceTemplateHtml } from "@/lib/billing/invoice-template-html";

/** @deprecated Template is now built in TypeScript — kept for callers that still import load. */
export function loadInvoiceTemplate(): string {
  return "";
}

export function renderInvoiceHtml(data: InvoiceDocumentData): string {
  return buildInvoiceTemplateHtml(data);
}
