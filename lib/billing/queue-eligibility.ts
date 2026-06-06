import {
  flattenOperationalLeaves,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  getRemainingRevenue,
  isFullyInvoiced,
  isFullyInvoicedBillingStatus,
} from "@/lib/billing/partial-invoice-lifecycle";

export type InvoiceableDeliverableRef = {
  id: string;
  campaign_line_id: string;
  kind: OperationalBillingRow["kind"];
  remaining_amount: number;
};

function rowHasVendorIo(row: Pick<OperationalBillingRow, "vendor_io_id" | "kind">): boolean {
  return Boolean(row.vendor_io_id);
}

function rowBlockedForQueue(row: OperationalBillingRow): boolean {
  if (row.billing_status === "disputed" || row.billing_status === "cancelled") return true;
  if (isFullyInvoicedBillingStatus(row.line_billing_status)) return true;
  if (["invoiced", "collected"].includes(row.billing_status) && row.remaining_amount <= 0) {
    return true;
  }
  return false;
}

export function hasRemainingInvoiceableRevenue(
  row: Pick<
    OperationalBillingRow,
    | "remaining_amount"
    | "billable_amount"
    | "invoiced_amount"
    | "billing_status"
    | "line_billing_status"
    | "is_locked"
  >
): boolean {
  const remaining = getRemainingRevenue(row);
  if (remaining <= 0) return false;
  if (isFullyInvoiced({ billable: row.billable_amount, invoiced: row.invoiced_amount, remaining })) {
    return false;
  }
  if (row.is_locked && remaining <= 0) return false;
  return true;
}

export function getRemainingInvoiceableDeliverables(
  rows: OperationalBillingRow[]
): InvoiceableDeliverableRef[] {
  const leaves = flattenOperationalLeaves(rows);
  const results: InvoiceableDeliverableRef[] = [];

  for (const row of leaves) {
    if (rowBlockedForQueue(row)) continue;
    if (!hasRemainingInvoiceableRevenue(row)) continue;
    if (row.kind === "assignment" && !rowHasVendorIo(row)) continue;

    results.push({
      id: row.id,
      campaign_line_id: row.campaign_line_id,
      kind: row.kind,
      remaining_amount: getRemainingRevenue(row),
    });
  }

  return results;
}

export function isAssignmentBillingEligible(row: OperationalBillingRow): boolean {
  if (row.kind !== "assignment") return false;
  if (rowBlockedForQueue(row)) return false;
  if (!rowHasVendorIo(row)) return false;

  const children = row.children ?? [];
  if (children.length > 0) {
    const childRefs = getRemainingInvoiceableDeliverables([row]);
    return childRefs.length > 0;
  }

  return hasRemainingInvoiceableRevenue(row);
}

/** Campaign billing queue stays visible while any assignment has uninvoiced revenue. */
export function campaignHasBillingQueueCandidates(rows: OperationalBillingRow[]): boolean {
  return getRemainingInvoiceableDeliverables(rows).length > 0;
}

/** Sum remaining invoiceable revenue across queue-eligible leaves. */
export function sumRemainingInvoiceableRevenue(rows: OperationalBillingRow[]): number {
  return getRemainingInvoiceableDeliverables(rows).reduce(
    (sum, row) => sum + row.remaining_amount,
    0
  );
}
