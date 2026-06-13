import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";

import type {
  StatementEntityOption,
  StatementGroupOption,
  StatementLedgerLine,
} from "./statement-types";

export type UnsettledIndexData = {
  search: string;
  groupId: string | null;
  clientType: ClientTypeFilter;
  groups: StatementGroupOption[];
  clients: StatementEntityOption[];
};

export type UnsettledReportQuery = {
  entityId: string | null;
};

export type UnsettledReportData = {
  entity_id: string | null;
  entity_name: string | null;
  entity_code: string | null;
  group_name: string | null;
  currency: string;
  currency_context: AnalyticsCurrencyContext;
  lines: StatementLedgerLine[];
  totals: {
    total_debit: number;
    total_credit: number;
    closing_balance: number;
  };
};
