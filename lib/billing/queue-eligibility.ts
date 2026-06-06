import { isCampaignBillingEligible } from "@/lib/billing/campaign-billing-eligibility";
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
  if (hasRemainingInvoiceableRevenue(row)) return false;
  if (isFullyInvoicedBillingStatus(row.line_billing_status)) return true;
  if (["invoiced", "collected"].includes(row.billing_status)) return true;
  return true;
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
  const results: InvoiceableDeliverableRef[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.kind !== "assignment") continue;
    const pricingMode = row.pricing_mode ?? "package";
    if (pricingMode !== "package") continue;
    if (rowBlockedForQueue(row)) continue;
    if (!rowHasVendorIo(row)) continue;
    if (!hasRemainingInvoiceableRevenue(row)) continue;

    results.push({
      id: row.id,
      campaign_line_id: row.campaign_line_id,
      kind: row.kind,
      remaining_amount: getRemainingRevenue(row),
    });
    seen.add(row.id);
  }

  const leaves = flattenOperationalLeaves(rows);
  for (const row of leaves) {
    const pricingMode = row.line_pricing_mode ?? row.pricing_mode ?? "package";
    if (pricingMode === "package" && row.kind !== "assignment") continue;
    if (rowBlockedForQueue(row)) continue;
    if (!hasRemainingInvoiceableRevenue(row)) continue;
    if (row.kind === "assignment" && !rowHasVendorIo(row)) continue;
    if (seen.has(row.id)) continue;

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
  return isCampaignBillingEligible(rows);
}

/** Sum remaining invoiceable revenue across queue-eligible leaves. */
export function sumRemainingInvoiceableRevenue(rows: OperationalBillingRow[]): number {
  return getRemainingInvoiceableDeliverables(rows).reduce(
    (sum, row) => sum + row.remaining_amount,
    0
  );
}
