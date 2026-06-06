import type { ErpDocumentHeader } from "@/lib/erp/payloads/types";

export type ClientInvoicePayloadInput = {
  document_number: string;
  issue_date: string;
  currency: string;
  client: { id: string; name: string; tax_id?: string | null };
  campaign_document_number?: string | null;
  subtotal: number;
  vat: number;
  total: number;
  line_items: {
    id: string;
    description: string;
    quantity?: number;
    unit_price: number;
    amount_before_vat: number;
    vat_rate: number;
    vat_amount: number;
    amount_after_vat: number;
  }[];
  metadata?: Record<string, unknown>;
};

export function buildClientInvoicePayload(
  input: ClientInvoicePayloadInput
): ErpDocumentHeader {
  return {
    schema_version: "1.0",
    source_system: "thinkway",
    document_kind: "client_invoice",
    document_number: input.document_number,
    issue_date: input.issue_date,
    currency: input.currency,
    party: {
      external_id: input.client.id,
      name: input.client.name,
      type: "client",
      currency: input.currency,
      tax_id: input.client.tax_id ?? null,
    },
    campaign_reference: input.campaign_document_number ?? null,
    amounts: {
      subtotal: input.subtotal,
      vat: input.vat,
      total: input.total,
    },
    line_items: input.line_items.map((line) => ({
      line_id: line.id,
      description: line.description,
      quantity: line.quantity ?? 1,
      unit_price: line.unit_price,
      amount_before_vat: line.amount_before_vat,
      vat_rate: line.vat_rate,
      vat_amount: line.vat_amount,
      amount_after_vat: line.amount_after_vat,
    })),
    metadata: {
      target_erps: ["odoo", "zoho", "erpnext", "netsuite"],
      ...input.metadata,
    },
  };
}
