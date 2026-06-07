import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import type { CampaignBillingQueueRow } from "@/lib/billing/campaign-billing-queue";
import {
  getCampaignInvoiceProgress,
  getCampaignRemainingRevenue,
  isCampaignBillingEligible,
} from "@/lib/billing/campaign-billing-eligibility";
import {
  getAssignmentBillingStatus,
  getAssignmentOpsStatus,
  type AssignmentLifecycleInput,
} from "@/lib/billing/assignment-lifecycle-state";
import { deriveCampaignBillingStatus } from "@/lib/billing/operational-billing-rows";

export type CampaignBillingSyncState = {
  billing_status: CampaignBillingQueueRow["billing_status"];
  remaining_to_invoice: number;
  already_invoiced: number;
  is_queue_eligible: boolean;
  progress: ReturnType<typeof getCampaignInvoiceProgress>;
};

export type AssignmentBillingSyncState = {
  operational_status: ReturnType<typeof getAssignmentOpsStatus>;
  billing_status: string;
};

/** Single source for campaign queue + billing tab rollup. */
export function syncCampaignBillingState(
  operational_rows: OperationalBillingRow[],
  rollup: Pick<
    CampaignBillingQueueRow,
    "already_invoiced" | "remaining_to_invoice" | "billing_status"
  >
): CampaignBillingSyncState {
  const progress = getCampaignInvoiceProgress(operational_rows);
  const queueRemaining = getCampaignRemainingRevenue(operational_rows);
  const remaining_to_invoice =
    rollup.remaining_to_invoice <= 0.01
      ? rollup.remaining_to_invoice
      : queueRemaining > 0
        ? Math.min(queueRemaining, rollup.remaining_to_invoice)
        : rollup.remaining_to_invoice;

  const billing_status =
    operational_rows.length > 0
      ? deriveCampaignBillingStatus(operational_rows)
      : rollup.billing_status;

  return {
    billing_status,
    remaining_to_invoice,
    already_invoiced: progress.invoiced > 0 ? progress.invoiced : rollup.already_invoiced,
    is_queue_eligible: isCampaignBillingEligible(operational_rows),
    progress,
  };
}

export function syncAssignmentInvoiceProgress(
  input: AssignmentLifecycleInput
): AssignmentBillingSyncState {
  return {
    operational_status: getAssignmentOpsStatus(input),
    billing_status: getAssignmentBillingStatus(input),
  };
}

/** Normalize operational row flags from assignment lifecycle (read-path sync). */
export function syncOperationalBillingState(
  rows: OperationalBillingRow[]
): OperationalBillingRow[] {
  return rows.map((row) => {
    if (row.kind !== "assignment") return row;

    const ops = getAssignmentOpsStatus({
      billing_status: row.billing_status,
      operational_status: row.operational_status,
      vendor_io_id: row.vendor_io_id,
      billable_amount: row.billable_amount,
      invoiced_amount: row.invoiced_amount,
      remaining_amount: row.remaining_amount,
      invoice_id: row.invoice_id,
    });

    const hasRemaining = row.remaining_amount > 0;
    const invoiceEligible =
      Boolean(row.vendor_io_id) &&
      hasRemaining &&
      (ops === "io_generated" || ops === "partially_invoiced" || ops === "io_revised");

    return {
      ...row,
      operational_status: ops,
      is_invoice_eligible: invoiceEligible,
      children: syncOperationalBillingState(row.children ?? []),
    };
  });
}
