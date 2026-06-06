/** Standardized ERP-ready JSON shapes (no API integration). */

export type ErpParty = {
  external_id: string;
  name: string;
  type: "client" | "vendor";
  currency: string;
  tax_id?: string | null;
};

export type ErpLineItem = {
  line_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount_before_vat: number;
  vat_rate: number;
  vat_amount: number;
  amount_after_vat: number;
};

export type ErpDocumentHeader = {
  schema_version: "1.0";
  source_system: "thinkway";
  document_kind: string;
  document_number: string;
  issue_date: string;
  currency: string;
  party: ErpParty;
  campaign_reference?: string | null;
  amounts: {
    subtotal: number;
    vat: number;
    total: number;
  };
  line_items: ErpLineItem[];
  metadata: Record<string, unknown>;
};

export type ErpPaymentPayload = {
  schema_version: "1.0";
  source_system: "thinkway";
  payment_reference: string;
  payment_date: string;
  currency: string;
  amount: number;
  party: ErpParty;
  allocations: {
    invoice_number: string;
    allocated_amount: number;
  }[];
  metadata: Record<string, unknown>;
};
