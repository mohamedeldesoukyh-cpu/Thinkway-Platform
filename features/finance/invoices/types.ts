export type FinanceInvoiceRegisterRow = {
  id: string;
  document_number: string;
  client_name: string;
  brand_name: string | null;
  campaign_name: string | null;
  campaign_document_number: string | null;
  revenue_before_vat: number;
  vat_amount: number;
  revenue_after_vat: number;
  status: string;
  locked_status: string;
  created_date: string;
  currency: string;
  regeneration_status: string | null;
  is_operational_locked?: boolean | null;
};
