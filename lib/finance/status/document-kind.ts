export type FinanceDocumentKind =
  | "client_invoice"
  | "vendor_io"
  | "client_credit_note"
  | "vendor_credit_note"
  | "client_debit_note"
  | "vendor_debit_note";

export const FINANCE_DOCUMENT_KIND_LABELS: Record<FinanceDocumentKind, string> = {
  client_invoice: "Client invoices",
  vendor_io: "Vendor IO",
  client_credit_note: "Client credit notes",
  vendor_credit_note: "Vendor credit notes",
  client_debit_note: "Client debit notes",
  vendor_debit_note: "Vendor debit notes",
};

export const POSTING_CENTER_TRANSACTION_TYPES: readonly FinanceDocumentKind[] = [
  "client_invoice",
  "vendor_io",
  "client_credit_note",
  "vendor_credit_note",
  "client_debit_note",
  "vendor_debit_note",
] as const;

export type AdjustmentDirection = "credit" | "debit";
export type AdjustmentParty = "client" | "vendor";

export type AdjustmentModuleKey =
  | "client_credit"
  | "vendor_credit"
  | "client_debit"
  | "vendor_debit";

export const ADJUSTMENT_MODULE_CONFIG: Record<
  AdjustmentModuleKey,
  {
    title: string;
    description: string;
    party: AdjustmentParty;
    direction: AdjustmentDirection;
    documentKind: FinanceDocumentKind;
    serialPrefix: string;
    sourceLabel: string;
  }
> = {
  client_credit: {
    title: "Client credit notes",
    description: "Reduce client receivable against issued invoices.",
    party: "client",
    direction: "credit",
    documentKind: "client_credit_note",
    serialPrefix: "CCN",
    sourceLabel: "Invoice",
  },
  vendor_credit: {
    title: "Vendor credit notes",
    description: "Reduce supplier payable against vendor IO or vendor invoices.",
    party: "vendor",
    direction: "credit",
    documentKind: "vendor_credit_note",
    serialPrefix: "VCN",
    sourceLabel: "Vendor IO",
  },
  client_debit: {
    title: "Client debit notes",
    description: "Increase client receivable for fees, penalties, or late additions.",
    party: "client",
    direction: "debit",
    documentKind: "client_debit_note",
    serialPrefix: "CDN",
    sourceLabel: "Invoice (optional)",
  },
  vendor_debit: {
    title: "Vendor debit notes",
    description: "Increase supplier payable for compensation or operational adjustments.",
    party: "vendor",
    direction: "debit",
    documentKind: "vendor_debit_note",
    serialPrefix: "VDN",
    sourceLabel: "Vendor IO",
  },
};
