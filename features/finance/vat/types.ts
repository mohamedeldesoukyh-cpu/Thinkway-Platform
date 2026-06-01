export type VatSettlementKpis = {
  revenue_before_vat: number;
  output_vat: number;
  input_vat: number;
  net_vat_payable: number;
  vat_reclaimable: number;
};

export type VatMonthlyRow = {
  month: string;
  label: string;
  output_vat: number;
  input_vat: number;
  net_vat_payable: number;
  revenue_before_vat: number;
};

export type VatCountryRow = {
  country_code: string;
  output_vat: number;
  input_vat: number;
  net_vat_payable: number;
};

export type VatEntityRow = {
  client_id: string;
  client_name: string;
  country_code: string | null;
  output_vat: number;
  revenue_before_vat: number;
};

export type VatInvoiceRow = {
  id: string;
  document_number: string;
  issue_date: string;
  client_name: string;
  country_code: string | null;
  revenue_before_vat: number;
  output_vat: number;
  total_after_vat: number;
  currency: string;
};

export type VatWorkspaceData = {
  kpis: VatSettlementKpis;
  monthly: VatMonthlyRow[];
  by_country: VatCountryRow[];
  by_entity: VatEntityRow[];
  invoices: VatInvoiceRow[];
  include_vat_in_operational: boolean;
};
