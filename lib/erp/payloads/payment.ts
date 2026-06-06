import type { ErpPaymentPayload } from "@/lib/erp/payloads/types";

export type PaymentPayloadInput = {
  payment_reference: string;
  payment_date: string;
  currency: string;
  amount: number;
  party: { id: string; name: string; type: "client" | "vendor" };
  allocations: { invoice_number: string; allocated_amount: number }[];
  metadata?: Record<string, unknown>;
};

export function buildPaymentPayload(input: PaymentPayloadInput): ErpPaymentPayload {
  return {
    schema_version: "1.0",
    source_system: "thinkway",
    payment_reference: input.payment_reference,
    payment_date: input.payment_date,
    currency: input.currency,
    amount: input.amount,
    party: {
      external_id: input.party.id,
      name: input.party.name,
      type: input.party.type,
      currency: input.currency,
    },
    allocations: input.allocations,
    metadata: {
      target_erps: ["odoo", "zoho", "erpnext", "netsuite"],
      ...input.metadata,
    },
  };
}
