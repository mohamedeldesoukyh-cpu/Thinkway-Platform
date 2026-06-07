import { isCampaignBillingEligible } from "@/lib/billing/campaign-billing-eligibility";
import {
  flattenOperationalLeaves,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  getRemainingRevenue,
  isFullyInvoiced,
  isFullyInvoicedBillingStatus,
  isPartiallyInvoicedBillingStatus,
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

function isRowOnPendingRegenerationInvoice(
  row: Pick<
    OperationalBillingRow,
    "invoice_regeneration_status" | "linked_invoice_id" | "invoice_id"
  >
): boolean {
  return (
    row.invoice_regeneration_status === "pending_regeneration" &&
    Boolean(row.linked_invoice_id ?? row.invoice_id)
  );
}

function rowIsTerminalInvoiced(
  row: Pick<
    OperationalBillingRow,
    | "billing_status"
    | "line_billing_status"
    | "billable_amount"
    | "invoiced_amount"
    | "remaining_amount"
  >
): boolean {
  const lineStatus = row.line_billing_status ?? row.billing_status;
  if (isPartiallyInvoicedBillingStatus(lineStatus)) return false;
  if (isPartiallyInvoicedBillingStatus(row.billing_status)) return false;

  const hasTerminalStatus =
    isFullyInvoicedBillingStatus(lineStatus) ||
    row.billing_status === "invoiced" ||
    row.billing_status === "collected";

  if (!hasTerminalStatus) return false;

  const remaining = getRemainingRevenue(row);
  return isFullyInvoiced({
    billable: row.billable_amount,
    invoiced: row.invoiced_amount,
    remaining,
  });
}

function rowBlockedForQueue(row: OperationalBillingRow): boolean {
  if (row.billing_status === "disputed" || row.billing_status === "cancelled") return true;
  if (isRowOnPendingRegenerationInvoice(row) && hasRemainingInvoiceableRevenue(row)) {
    return false;
  }
  if (rowIsTerminalInvoiced(row)) return true;
  if (hasRemainingInvoiceableRevenue(row)) return false;
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
    | "invoice_regeneration_status"
    | "linked_invoice_id"
    | "invoice_id"
  >
): boolean {
  const pendingRegeneration =
    row.invoice_regeneration_status === "pending_regeneration" &&
    Boolean(row.linked_invoice_id ?? row.invoice_id);

  if (!pendingRegeneration && rowIsTerminalInvoiced(row)) {
    return false;
  }

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

/** Billable assignment revenue only after Vendor IO exists (billing ops gate). */
export function sumIoGatedAssignmentBillable(rows: OperationalBillingRow[]): number {
  return rows.reduce((sum, row) => {
    if (row.kind !== "assignment") return sum;
    if (!rowHasVendorIo(row)) return sum;
    return sum + Number(row.billable_amount ?? 0);
  }, 0);
}
