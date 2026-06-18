export type ClientCreditLimitRow = {
  id: string;
  document_number: string;
  name: string;
  legal_name: string | null;
  currency: string;
  credit_limit: number | null;
  credit_limit_active: boolean;
  accept_credit_risk: boolean;
  exposure: number;
  available: number | null;
};

export type CreditLimitWorkspaceData = {
  clients: ClientCreditLimitRow[];
  total: number;
};
