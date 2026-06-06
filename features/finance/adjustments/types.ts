import type { FinanceAdjustmentStatus } from "@/lib/finance/status/adjustment-status";
import type { AdjustmentModuleKey } from "@/lib/finance/status/document-kind";

export type FinanceAdjustmentRegisterRow = {
  id: string;
  document_number: string;
  status: FinanceAdjustmentStatus;
  issue_date: string;
  reason: string;
  amount_before_vat: number;
  vat_amount: number;
  amount_after_vat: number;
  vat_affected: boolean;
  currency: string;
  source_document_number: string | null;
  client_name: string | null;
  vendor_name: string | null;
  campaign_document_number: string | null;
  campaign_name: string | null;
  posted_at: string | null;
};

export type InvoiceSearchResult = {
  id: string;
  document_number: string;
  client_name: string;
  brand_name: string | null;
  campaign_document_number: string | null;
  campaign_name: string | null;
  issue_date: string;
  revenue_before_vat: number;
  vat_amount: number;
  total_after_vat: number;
  currency: string;
  status: string;
};

export type CreateClientCreditNoteInput = {
  invoice_id: string;
  issue_date: string;
  reason: string;
  amount_before_vat: number;
  vat_affected: boolean;
  notes?: string;
};

export type AdjustmentModuleProps = {
  moduleKey: AdjustmentModuleKey;
};
