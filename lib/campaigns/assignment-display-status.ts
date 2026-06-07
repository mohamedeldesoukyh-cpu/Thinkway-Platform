import type { CampaignLineBillingStatus } from "@/features/billing/types";
import type {
  AssignmentHierarchyRollups,
} from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignLineWorkspace } from "@/features/campaigns/types";
import {
  calculateAssignmentInvoiceProgress,
  getRemainingRevenue,
} from "@/lib/billing/partial-invoice-lifecycle";

/**
 * Assignment billing column — prefer financial proof over stale header billing_status
 * (e.g. after VIO ungenerate or partial invoice relock on another line).
 */
export function effectiveAssignmentBillingStatusForUi(
  line: CampaignLineWorkspace,
  rollups: AssignmentHierarchyRollups
): CampaignLineBillingStatus {
  const billable = Number(rollups.revenue ?? line.revenue_before_vat ?? line.revenue ?? 0);
  const invoiced = Number(rollups.invoiced_value ?? 0);
  const remaining = getRemainingRevenue({
    billable_amount: billable,
    invoiced_amount: invoiced,
    remaining_amount: rollups.remaining_value,
  });
  const progress = calculateAssignmentInvoiceProgress({ billable, invoiced, remaining });

  if (progress.state === "full" && invoiced > 0.01) {
    return "invoiced";
  }
  if (progress.state === "partial") {
    return "partially_invoiced";
  }

  const header = (line.billing_status ?? "draft") as CampaignLineBillingStatus;
  const hasIo = Boolean(line.vendor_io_id || line.active_vendor_io_id);

  if (!hasIo) {
    if (
      ["moved_to_billing", "partially_invoiced", "invoiced", "partially_paid", "paid"].includes(
        header
      ) &&
      invoiced <= 0.01
    ) {
      return "approved";
    }
    return header === "moved_to_billing" ? "approved" : header;
  }

  if (["invoiced", "paid", "closed"].includes(header) && invoiced <= 0.01) {
    return "moved_to_billing";
  }

  return header;
}
