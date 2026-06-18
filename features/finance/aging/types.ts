import type { AgingSummary } from "@/lib/collections/aging";
import type {
  AgingBasis,
  AgingReportMode,
} from "@/lib/finance/aging";
import type {
  ClientAgingDetailRow,
  ClientAgingSummaryRow,
} from "@/lib/finance/aging/aggregate";

export type AgingReportView = "summary" | "detailed";

export type AgingReportQuery = {
  mode: AgingReportMode;
  view: AgingReportView;
  clientId?: string | null;
};

export type AgingWorkspaceData = {
  mode: AgingReportMode;
  view: AgingReportView;
  basis: AgingBasis;
  basis_label: string;
  as_of: string;
  summary: AgingSummary;
  client_rows: ClientAgingSummaryRow[];
  detail_rows: ClientAgingDetailRow[];
  currencies: string[];
  mixed_currency: boolean;
  invoice_count: number;
  client_count: number;
};
