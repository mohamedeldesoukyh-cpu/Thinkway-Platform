import {
  getRemainingRevenue,
  isPartiallyInvoicedBillingStatus,
} from "@/lib/billing/partial-invoice-lifecycle";

const TERMINAL_BILLING = new Set(["void", "cancelled", "closed"]);

export type RegenerationEligibilityInput = {
  billing_status?: string | null;
  operational_status?: string | null;
  vendor_io_id?: string | null;
  invoice_id?: string | null;
  regeneration_status?: string | null;
  invoice_status?: string | null;
  is_operational_locked?: boolean | null;
  finance_override_until?: string | null;
  remaining_amount?: number | null;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
};

function hasActiveFinanceOverride(until: string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}

export function hasRegeneratableRevenue(
  input: Pick<
    RegenerationEligibilityInput,
    "remaining_amount" | "billable_amount" | "invoiced_amount"
  >
): boolean {
  return (
    getRemainingRevenue({
      remaining_amount: input.remaining_amount,
      billable_amount: input.billable_amount,
      invoiced_amount: input.invoiced_amount,
    }) > 0
  );
}

export function isInvoiceLifecycleReopenable(
  input: RegenerationEligibilityInput
): boolean {
  const billing = input.billing_status ?? "draft";
  if (TERMINAL_BILLING.has(billing)) return false;
  if (input.invoice_status === "void") return false;
  if (!input.vendor_io_id) return false;

  if (input.regeneration_status === "pending_regeneration") return true;
  if (input.invoice_status === "draft" && Boolean(input.invoice_id)) return true;
  if (hasActiveFinanceOverride(input.finance_override_until ?? null)) return true;

  if (isPartiallyInvoicedBillingStatus(billing)) return true;
  if (billing === "moved_to_billing" && Number(input.invoiced_amount ?? 0) > 0) {
    return true;
  }

  const ops = input.operational_status ?? "draft";
  if (["io_revised", "reopened", "partially_invoiced"].includes(ops)) return true;
  if (ops === "io_generated" && Number(input.invoiced_amount ?? 0) > 0) return true;

  if (Number(input.invoiced_amount ?? 0) > 0) return true;
  if (hasInvoiceLinkage(input)) return true;

  return false;
}

export function canRegenerateInvoice(input: RegenerationEligibilityInput): boolean {
  if (!input.vendor_io_id) return false;

  const billing = input.billing_status ?? "draft";
  if (TERMINAL_BILLING.has(billing)) return false;

  if (hasRegeneratableRevenue(input)) return true;

  return isInvoiceLifecycleReopenable(input);
}

export function hasInvoiceLinkage(
  input: Pick<
    RegenerationEligibilityInput,
    "invoice_id" | "invoiced_amount" | "billing_status"
  >
): boolean {
  if (input.invoice_id) return true;
  if (Number(input.invoiced_amount ?? 0) > 0) return true;
  if (isPartiallyInvoicedBillingStatus(input.billing_status ?? "")) return true;
  if (["invoiced", "partially_paid", "paid"].includes(input.billing_status ?? "")) {
    return true;
  }
  return false;
}

export function resolveInvoiceActionLabel(input: {
  invoiceLineIds: string[];
  getRow: (lineId: string) => RegenerationEligibilityInput | null;
}): "generate" | "regenerate" | null {
  if (input.invoiceLineIds.length === 0) return null;

  const hasRegenerateContext = input.invoiceLineIds.some((lineId) => {
    const row = input.getRow(lineId);
    if (!row) return false;
    const hasRemaining = hasRegeneratableRevenue(row);
    const linkage = hasInvoiceLinkage(row);
    const reopenable = isInvoiceLifecycleReopenable(row);
    if (hasRemaining && linkage && reopenable) return true;
    if (!hasRemaining && linkage && canRegenerateInvoice(row)) return true;
    if (linkage && reopenable && canRegenerateInvoice(row)) return true;
    return false;
  });

  return hasRegenerateContext ? "regenerate" : "generate";
}
