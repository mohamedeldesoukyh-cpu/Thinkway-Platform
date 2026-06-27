import type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/operational-utils";
import {
  calculateAssignmentInvoiceProgress,
  deriveAssignmentBillingStatusFromProgress,
  getRemainingRevenue,
  type AssignmentInvoiceProgress,
} from "@/lib/billing/partial-invoice-lifecycle";

export type AssignmentLifecycleInput = {
  billing_status?: string | null;
  operational_status?: string | null;
  vendor_io_id?: string | null;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
  remaining_amount?: number | null;
  invoice_id?: string | null;
  revenue_locked?: boolean | null;
};

export function calculateAssignmentCompletion(
  input: Pick<
    AssignmentLifecycleInput,
    "billable_amount" | "invoiced_amount" | "remaining_amount"
  >
): AssignmentInvoiceProgress {
  return calculateAssignmentInvoiceProgress({
    billable: Number(input.billable_amount ?? 0),
    invoiced: Number(input.invoiced_amount ?? 0),
    remaining: input.remaining_amount ?? undefined,
  });
}

/** OPS column: IO Generated → Partially Invoiced → Locked from remaining revenue. */
export function getAssignmentOpsStatus(
  input: AssignmentLifecycleInput
): CampaignLineOperationalStatus {
  const billing = input.billing_status ?? "draft";
  if (billing === "closed") return "closed";
  if (!input.vendor_io_id) return "draft";

  const progress = calculateAssignmentCompletion(input);
  const remaining = getRemainingRevenue({
    remaining_amount: input.remaining_amount,
    billable_amount: input.billable_amount,
    invoiced_amount: input.invoiced_amount,
  });

  if (remaining <= 0.01 && progress.invoiced > 0) {
    return "locked";
  }
  if (progress.invoiced > 0 && remaining > 0.01) {
    return "partially_invoiced";
  }
  if (input.operational_status === "io_revised" || input.operational_status === "reopened") {
    return "io_revised";
  }
  return "io_generated";
}

/** Billing column from financial progress. */
export function getAssignmentBillingStatus(
  input: AssignmentLifecycleInput
): string {
  const progress = calculateAssignmentCompletion(input);
  return deriveAssignmentBillingStatusFromProgress(progress, input.billing_status ?? undefined);
}
