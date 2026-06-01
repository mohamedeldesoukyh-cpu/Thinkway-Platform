export type ExchangeRateRow = {
  id: string;
  from_currency: string;
  to_currency: string;
  exchange_rate: number;
  effective_start_date: string;
  effective_end_date: string | null;
  is_active: boolean;
  source: string | null;
  notes: string | null;
  created_at: string;
};

export type CurrencyMasterRow = {
  code: string;
  name: string;
  symbol: string | null;
  decimal_places: number;
  country_code: string | null;
  is_active: boolean;
};

export type FxAuditLogRow = {
  id: string;
  action: string;
  override_reason: string | null;
  recalculation_scope: string | null;
  impacted_record_count: number;
  created_at: string;
  changed_by_name: string | null;
  old_data: Record<string, unknown>;
  new_data: Record<string, unknown>;
};

export type ExchangeRatesWorkspaceData = {
  currencies: CurrencyMasterRow[];
  rates: ExchangeRateRow[];
  fx_history: FxAuditLogRow[];
};
