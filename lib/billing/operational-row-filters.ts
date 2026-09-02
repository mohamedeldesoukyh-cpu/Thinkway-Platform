import type { CampaignBillingQueueFilter } from "@/lib/billing/campaign-billing-queue";
import {
  isOperationalRowAchieved,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import { traceChildrenAccess } from "@/lib/billing/operational-billing-trace";

export type OperationalBillingFilter =
  | "all"
  | "invoiced"
  | "not_invoiced"
  | "partially_invoiced"
  | "fully_achieved"
  | "partially_achieved"
  | "draft"
  | "approved"
  | "moved_to_billing";

export const OPERATIONAL_BILLING_FILTER_OPTIONS: {
  value: OperationalBillingFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "invoiced", label: "Invoiced" },
  { value: "not_invoiced", label: "Not invoiced" },
  { value: "partially_invoiced", label: "Partially invoiced" },
  { value: "fully_achieved", label: "Fully achieved" },
  { value: "partially_achieved", label: "Partially achieved" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "moved_to_billing", label: "Moved to billing" },
];

/** Maps campaign queue finance filters to operational row filters (1:1). */
export function mapCampaignQueueFilterToOperational(
  filter: CampaignBillingQueueFilter
): OperationalBillingFilter {
  return filter;
}

function rowMatchesOperationalFilter(
  row: OperationalBillingRow,
  filter: OperationalBillingFilter
): boolean {
  if (filter === "all") return true;

  const lineStatus = row.line_billing_status;
  const status = row.billing_status;
  const billable = row.billable_amount;
  const invoiced = row.invoiced_amount;
  const remaining = row.remaining_amount;

  switch (filter) {
    case "invoiced":
      return billable > 0 && invoiced > 0 && remaining <= 0.01;
    case "not_invoiced":
      return billable > 0 && invoiced <= 0.01 && remaining > 0.01;
    case "partially_invoiced":
      return invoiced > 0.01 && remaining > 0.01;
    case "approved":
      return lineStatus === "approved" || status === "ready_to_invoice";
    case "moved_to_billing":
      return (
        lineStatus === "moved_to_billing" ||
        ["ready_to_invoice", "partially_invoiced"].includes(status)
      );
    case "fully_achieved":
      return (
        row.billable_amount > 0 &&
        isOperationalRowAchieved(row) &&
        invoiced > 0.01 &&
        remaining <= 0.01
      );
    case "partially_achieved":
      return row.billable_amount > 0 && !isOperationalRowAchieved(row);
    case "draft":
      return lineStatus === "draft" || status === "draft";
    default:
      return true;
  }
}

function filterOperationalNode(
  row: OperationalBillingRow,
  filter: OperationalBillingFilter
): OperationalBillingRow | null {
  if (filter === "all") return row;

  traceChildrenAccess("filterOperationalNode:children.map", row, "map");
  const filteredChildren = row.children
    .map((child) => filterOperationalNode(child, filter))
    .filter(Boolean) as OperationalBillingRow[];

  const selfMatches = rowMatchesOperationalFilter(row, filter);

  if (filteredChildren.length > 0) {
    return { ...row, children: filteredChildren };
  }

  if (selfMatches) {
    return { ...row, children: [] };
  }

  return null;
}

const filterTreeCache = new WeakMap<
  OperationalBillingRow[],
  Map<OperationalBillingFilter, OperationalBillingRow[]>
>();

function filterOperationalBillingTreeUncached(
  rows: OperationalBillingRow[],
  filter: OperationalBillingFilter
): OperationalBillingRow[] {
  return rows
    .map((row) => filterOperationalNode(row, filter))
    .filter(Boolean) as OperationalBillingRow[];
}

/** Filters operational hierarchy while preserving assignment → deliverable → post structure. */
export function filterOperationalBillingTree(
  rows: OperationalBillingRow[],
  filter: OperationalBillingFilter
): OperationalBillingRow[] {
  if (filter === "all") return rows;

  let byFilter = filterTreeCache.get(rows);
  if (!byFilter) {
    byFilter = new Map();
    filterTreeCache.set(rows, byFilter);
  }

  const cached = byFilter.get(filter);
  if (cached) return cached;

  const filtered = filterOperationalBillingTreeUncached(rows, filter);
  byFilter.set(filter, filtered);
  return filtered;
}
