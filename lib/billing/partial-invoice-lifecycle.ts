/** Formal partial invoicing progress for assignments and operational rows. */

export type AssignmentInvoiceProgress = {
  billable: number;
  invoiced: number;
  remaining: number;
  percent_invoiced: number;
  state: "none" | "partial" | "full";
};

const FULLY_INVOICED_BILLING = new Set([
  "invoiced",
  "paid",
  "closed",
]);

const PARTIAL_BILLING = new Set([
  "partially_invoiced",
  "partially_paid",
  "partially_collected",
]);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateAssignmentInvoiceProgress(input: {
  billable: number;
  invoiced: number;
  remaining?: number;
}): AssignmentInvoiceProgress {
  const billable = roundMoney(Math.max(0, input.billable));
  const invoiced = roundMoney(Math.max(0, input.invoiced));
  const remaining = roundMoney(
    input.remaining != null
      ? Math.max(0, input.remaining)
      : Math.max(0, billable - invoiced)
  );

  let state: AssignmentInvoiceProgress["state"] = "none";
  if (billable > 0 && remaining <= 0.01 && invoiced > 0) {
    state = "full";
  } else if (invoiced > 0 && remaining > 0.01) {
    state = "partial";
  }

  const percent_invoiced =
    billable > 0 ? roundMoney((invoiced / billable) * 100) : 0;

  return { billable, invoiced, remaining, percent_invoiced, state };
}

export function isFullyInvoiced(input: {
  billable: number;
  invoiced: number;
  remaining: number;
}): boolean {
  return calculateAssignmentInvoiceProgress(input).state === "full";
}

export function isPartiallyInvoiced(input: {
  billable: number;
  invoiced: number;
  remaining: number;
}): boolean {
  return calculateAssignmentInvoiceProgress(input).state === "partial";
}

export function getRemainingRevenue(input: {
  remaining_amount?: number | null;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
}): number {
  const remaining = Number(input.remaining_amount ?? NaN);
  if (Number.isFinite(remaining) && remaining > 0) {
    return roundMoney(remaining);
  }
  const billable = Number(input.billable_amount ?? 0);
  const invoiced = Number(input.invoiced_amount ?? 0);
  return roundMoney(Math.max(0, billable - invoiced));
}

export function isFullyInvoicedBillingStatus(status: string): boolean {
  return FULLY_INVOICED_BILLING.has(status);
}

export function isPartiallyInvoicedBillingStatus(status: string): boolean {
  return PARTIAL_BILLING.has(status) || status === "partially_invoiced";
}

/** Derive assignment billing status from financial progress. */
export function deriveAssignmentBillingStatusFromProgress(
  progress: AssignmentInvoiceProgress,
  currentStatus?: string
): string {
  if (progress.state === "full") return "invoiced";
  if (progress.state === "partial") return "partially_invoiced";
  if (currentStatus === "moved_to_billing" || currentStatus === "approved") {
    return currentStatus;
  }
  return currentStatus ?? "moved_to_billing";
}

/** OPS column: IO Generated → Partially Invoiced → Locked from progress. */
export function operationalStatusForInvoiceProgress(input: {
  billing_status: string;
  vendor_io_id: string | null | undefined;
  progress: AssignmentInvoiceProgress;
}): "io_generated" | "partially_invoiced" | "locked" | "io_revised" | "draft" | "closed" {
  if (input.billing_status === "closed") return "closed";
  if (!input.vendor_io_id) return "draft";
  if (isFullyInvoicedBillingStatus(input.billing_status) || input.progress.state === "full") {
    return "locked";
  }
  if (input.progress.state === "partial" || isPartiallyInvoicedBillingStatus(input.billing_status)) {
    return "partially_invoiced";
  }
  return "io_generated";
}
