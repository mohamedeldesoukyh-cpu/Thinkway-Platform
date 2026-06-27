import {
  normalizeOperationalStatus,
  normalizeOperationalStatusForOpsBadge,
} from "@/lib/campaigns/operational-status-utils";
import type { CampaignLineOperationalStatus } from "@/lib/domains/campaign/operational-utils";
import { getAssignmentOpsStatus } from "@/lib/billing/assignment-lifecycle-state";
import {
  getRemainingRevenue,
  isFullyInvoicedBillingStatus,
  isPartiallyInvoicedBillingStatus,
} from "@/lib/billing/partial-invoice-lifecycle";

/**
 * Derive UI/eligibility status when DB operational_status is stale (e.g. prod not backfilled).
 * Canonical values still come from syncLineOperationalStatus after billing/IO actions.
 */
export function effectiveLineOperationalStatus(input: {
  operational_status: string | null | undefined;
  vendor_io_id: string | null | undefined;
  billing_status?: string | null | undefined;
  invoice_id?: string | null | undefined;
  finance_override_until?: string | null | undefined;
  revenue_locked?: boolean | null;
  vendor_assignment_locked?: boolean | null;
  remaining_amount?: number | null;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
}): CampaignLineOperationalStatus {
  const raw = (input.operational_status ?? "draft") as CampaignLineOperationalStatus;
  const billing = input.billing_status ?? "draft";

  if (raw === "io_generated" && !input.vendor_io_id) {
    return "draft";
  }

  if (raw === "moved_to_billing" && input.vendor_io_id) {
    return "io_generated";
  }

  if (input.finance_override_until) {
    const until = new Date(input.finance_override_until).getTime();
    if (Number.isFinite(until) && until > Date.now() && input.vendor_io_id) {
      return "io_revised";
    }
  }

  if (raw === "io_revised" || raw === "reopened") {
    return "io_revised";
  }

  const remaining = getRemainingRevenue({
    remaining_amount: input.remaining_amount,
    billable_amount: input.billable_amount,
    invoiced_amount: input.invoiced_amount,
  });

  if (
    input.remaining_amount != null ||
    input.billable_amount != null ||
    input.invoiced_amount != null
  ) {
    return getAssignmentOpsStatus({
      billing_status: billing,
      operational_status: raw,
      vendor_io_id: input.vendor_io_id,
      billable_amount: input.billable_amount,
      invoiced_amount: input.invoiced_amount,
      remaining_amount: remaining,
      invoice_id: input.invoice_id,
      revenue_locked: input.revenue_locked,
    });
  }

  if (isFullyInvoicedBillingStatus(billing)) {
    return "locked";
  }

  if (isPartiallyInvoicedBillingStatus(billing) && input.vendor_io_id) {
    return "partially_invoiced";
  }

  const fullyLocked =
    Boolean(input.invoice_id) &&
    isFullyInvoicedBillingStatus(billing);

  if (
    fullyLocked ||
    (Boolean(input.revenue_locked) && isFullyInvoicedBillingStatus(billing)) ||
    (Boolean(input.vendor_assignment_locked) && isFullyInvoicedBillingStatus(billing))
  ) {
    return "locked";
  }

  if (raw === "locked" && isFullyInvoicedBillingStatus(billing)) {
    return "locked";
  }

  if (raw === "partially_invoiced" && input.vendor_io_id) {
    return "partially_invoiced";
  }

  if (raw === "invoiced") {
    return "locked";
  }

  if (raw !== "draft") return normalizeOperationalStatus(raw);

  if (billing === "closed") return "closed";

  if (input.vendor_io_id) return "io_generated";

  return "draft";
}

/** Safe status for UI maps (row classes, badges) — Ops never shows Invoiced. */
export function effectiveLineOperationalStatusForUi(
  input: Parameters<typeof effectiveLineOperationalStatus>[0]
): CampaignLineOperationalStatus {
  return normalizeOperationalStatusForOpsBadge(effectiveLineOperationalStatus(input));
}
