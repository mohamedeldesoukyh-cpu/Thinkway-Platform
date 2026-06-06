import type { ErpDocumentHeader } from "@/lib/erp/payloads/types";

export type CreditNotePayloadInput = {
  document_number: string;
  issue_date: string;
  currency: string;
  party: { id: string; name: string; type: "client" | "vendor" };
  source_document_number: string;
  reason: string;
  amount_before_vat: number;
  vat_amount: number;
  amount_after_vat: number;
  vat_affected: boolean;
  metadata?: Record<string, unknown>;
};

export function buildCreditNotePayload(input: CreditNotePayloadInput): ErpDocumentHeader {
  const kind =
    input.party.type === "client" ? "client_credit_note" : "vendor_credit_note";

  return {
    schema_version: "1.0",
    source_system: "thinkway",
    document_kind: kind,
    document_number: input.document_number,
    issue_date: input.issue_date,
    currency: input.currency,
    party: {
      external_id: input.party.id,
      name: input.party.name,
      type: input.party.type,
      currency: input.currency,
    },
    campaign_reference: null,
    amounts: {
      subtotal: input.amount_before_vat,
      vat: input.vat_amount,
      total: input.amount_after_vat,
    },
    line_items: [
      {
        line_id: input.document_number,
        description: input.reason,
        quantity: 1,
        unit_price: input.amount_before_vat,
        amount_before_vat: input.amount_before_vat,
        vat_rate: input.vat_affected ? input.vat_amount / Math.max(input.amount_before_vat, 0.01) : 0,
        vat_amount: input.vat_amount,
        amount_after_vat: input.amount_after_vat,
      },
    ],
    metadata: {
      source_document_number: input.source_document_number,
      adjustment_direction: "credit",
      target_erps: ["odoo", "zoho", "erpnext", "netsuite"],
      ...input.metadata,
    },
  };
}
