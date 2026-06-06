import type { ErpDocumentHeader } from "@/lib/erp/payloads/types";

export type VendorBillPayloadInput = {
  document_number: string;
  issue_date: string;
  currency: string;
  vendor: { id: string; name: string };
  campaign_document_number?: string | null;
  subtotal: number;
  vat: number;
  total: number;
  line_items: {
    id: string;
    description: string;
    amount_before_vat: number;
    vat_rate: number;
    vat_amount: number;
    amount_after_vat: number;
  }[];
  metadata?: Record<string, unknown>;
};

export function buildVendorBillPayload(input: VendorBillPayloadInput): ErpDocumentHeader {
  return {
    schema_version: "1.0",
    source_system: "thinkway",
    document_kind: "vendor_io",
    document_number: input.document_number,
    issue_date: input.issue_date,
    currency: input.currency,
    party: {
      external_id: input.vendor.id,
      name: input.vendor.name,
      type: "vendor",
      currency: input.currency,
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
      quantity: 1,
      unit_price: line.amount_before_vat,
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
