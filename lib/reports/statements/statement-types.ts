import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";

export type StatementType = "client" | "vendor";

export type StatementLedgerLineKind =
  | "invoice"
  | "payment"
  | "vendor_io"
  | "vendor_payment";

export type StatementLedgerLine = {
  date: string;
  document_number: string;
  campaign_name: string | null;
  debit: number;
  credit: number;
  balance: number;
  currency: string;
  kind: StatementLedgerLineKind;
};

export type StatementGroupOption = {
  id: string;
  name: string;
  code: string | null;
};

export type StatementEntityOption = {
  id: string;
  name: string;
  code: string | null;
  group_name?: string | null;
};

export type StatementsIndexData = {
  type: StatementType;
  search: string;
  groupId: string | null;
  clientType: ClientTypeFilter;
  groups: StatementGroupOption[];
  clients: StatementEntityOption[];
  vendors: StatementEntityOption[];
};

export type StatementsReportQuery = {
  type: StatementType;
  entityId: string | null;
  fromDate: string | null;
  toDate: string | null;
};

export type StatementsReportData = {
  type: StatementType;
  entity_id: string | null;
  entity_name: string | null;
  entity_code: string | null;
  group_name: string | null;
  from_date: string | null;
  to_date: string | null;
  currency: string;
  currency_context: AnalyticsCurrencyContext;
  lines: StatementLedgerLine[];
  totals: {
    total_debit: number;
    total_credit: number;
    closing_balance: number;
  };
  clients: StatementEntityOption[];
  vendors: StatementEntityOption[];
};
