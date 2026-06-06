import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import {
  calculateAssignmentInvoiceProgress,
  type AssignmentInvoiceProgress,
} from "@/lib/billing/partial-invoice-lifecycle";
import {
  getRemainingInvoiceableDeliverables,
  isAssignmentBillingEligible,
  sumRemainingInvoiceableRevenue,
} from "@/lib/billing/queue-eligibility";

const TERMINAL_ASSIGNMENT_BILLING = new Set(["invoiced", "paid", "closed", "cancelled"]);

function assignmentHasQueueSignal(row: OperationalBillingRow): boolean {
  if (row.kind !== "assignment") return false;
  if (row.billing_status === "cancelled") return false;

  const ops = row.operational_status ?? "draft";
  if (ops === "io_generated" || ops === "partially_invoiced") {
    return row.remaining_amount > 0 || isAssignmentBillingEligible(row);
  }

  return isAssignmentBillingEligible(row);
}

/** Campaign stays in queue until every assignment is fully invoiced or terminal. */
export function isCampaignBillingEligible(rows: OperationalBillingRow[]): boolean {
  const assignments = rows.filter((row) => row.kind === "assignment");
  if (assignments.length === 0) {
    return getRemainingInvoiceableDeliverables(rows).length > 0;
  }

  return assignments.some((row) => {
    if (row.billing_status === "cancelled") return false;
    if (assignmentHasQueueSignal(row)) return true;
    return isAssignmentBillingEligible(row);
  });
}

export function getCampaignRemainingRevenue(rows: OperationalBillingRow[]): number {
  return sumRemainingInvoiceableRevenue(rows);
}

export function getCampaignInvoiceProgress(
  rows: OperationalBillingRow[]
): AssignmentInvoiceProgress {
  const assignments = rows.filter((row) => row.kind === "assignment");
  if (assignments.length === 0) {
    const leaves = getRemainingInvoiceableDeliverables(rows);
    const remaining = leaves.reduce((sum, leaf) => sum + leaf.remaining_amount, 0);
    return calculateAssignmentInvoiceProgress({ billable: remaining, invoiced: 0, remaining });
  }

  let billable = 0;
  let invoiced = 0;
  let remaining = 0;

  for (const row of assignments) {
    if (TERMINAL_ASSIGNMENT_BILLING.has(row.billing_status) && row.remaining_amount <= 0) {
      continue;
    }
    const progress = calculateAssignmentInvoiceProgress({
      billable: row.billable_amount,
      invoiced: row.invoiced_amount,
      remaining: row.remaining_amount,
    });
    billable += progress.billable;
    invoiced += progress.invoiced;
    remaining += progress.remaining;
  }

  return calculateAssignmentInvoiceProgress({ billable, invoiced, remaining });
}
