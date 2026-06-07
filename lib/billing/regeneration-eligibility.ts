import {
  getRemainingRevenue,
  isFullyInvoicedBillingStatus,
  isPartiallyInvoicedBillingStatus,
} from "@/lib/billing/partial-invoice-lifecycle";
import { hasExistingIoCoverage } from "@/lib/operations/io-coverage";

const TERMINAL_BILLING = new Set(["void", "cancelled", "closed"]);

export type RegenerationEligibilityInput = {
  billing_status?: string | null;
  operational_status?: string | null;
  vendor_io_id?: string | null;
  active_vendor_io_id?: string | null;
  vendor_io_document_number?: string | null;
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

const MONEY_EPSILON = 0.01;

/** True only when financial or header proof shows this assignment was on an invoice before. */
export function hasLineEverBeenInvoiced(
  input: Pick<
    RegenerationEligibilityInput,
    "invoice_id" | "invoiced_amount" | "billing_status"
  >
): boolean {
  if (input.invoice_id) return true;
  if (Number(input.invoiced_amount ?? 0) > MONEY_EPSILON) return true;

  const billing = input.billing_status ?? "draft";
  if (billing === "partially_invoiced") {
    return Number(input.invoiced_amount ?? 0) > MONEY_EPSILON;
  }
  if (["invoiced", "partially_paid", "paid"].includes(billing)) {
    return Boolean(input.invoice_id) || Number(input.invoiced_amount ?? 0) > MONEY_EPSILON;
  }
  return false;
}

/** Assignment has IO and billable remaining but was never on an invoice — first-time generate/append. */
export function isLineFirstTimeInvoiceEligible(
  input: RegenerationEligibilityInput
): boolean {
  if (hasLineEverBeenInvoiced(input)) return false;
  if (TERMINAL_BILLING.has(input.billing_status ?? "draft")) return false;

  const hasIo = hasExistingIoCoverage({
    vendor_io_id: input.vendor_io_id,
    active_vendor_io_id: input.active_vendor_io_id,
    vendor_io_document_number: input.vendor_io_document_number,
  });
  if (!hasIo) return false;

  return hasRegeneratableRevenue(input);
}

/** Previously invoiced (or ungenerated with active override) and eligible to rebuild. */
export function isLineRegenerateEligible(input: RegenerationEligibilityInput): boolean {
  if (!canRegenerateInvoice(input)) return false;
  if (hasLineEverBeenInvoiced(input)) return true;
  return input.regeneration_status === "pending_regeneration";
}

export function partitionInvoiceLineIdsByAction(
  lineIds: string[],
  getRow: (lineId: string) => RegenerationEligibilityInput | null
): { regenerateLineIds: string[]; generateLineIds: string[] } {
  const regenerateLineIds: string[] = [];
  const generateLineIds: string[] = [];

  for (const lineId of lineIds) {
    const row = getRow(lineId);
    if (!row) continue;
    if (isLineRegenerateEligible(row)) {
      regenerateLineIds.push(lineId);
    } else if (isLineFirstTimeInvoiceEligible(row)) {
      generateLineIds.push(lineId);
    }
  }

  return { regenerateLineIds, generateLineIds };
}

export type ResolvedInvoiceSelectionAction = {
  action: "generate" | "regenerate" | null;
  regenerateLineIds: string[];
  generateLineIds: string[];
  /** Line ids to pass into the UI action matching `action`. */
  actionLineIds: string[];
};

/**
 * Per-line invoice action — scales to any assignment count.
 * Regenerate only when every selected line was previously invoiced.
 * Otherwise generate (append to existing or create new).
 */
export function resolveInvoiceActionForSelection(input: {
  lineIds: string[];
  getRow: (lineId: string) => RegenerationEligibilityInput | null;
}): ResolvedInvoiceSelectionAction {
  const { regenerateLineIds, generateLineIds } = partitionInvoiceLineIdsByAction(
    input.lineIds,
    input.getRow
  );

  if (input.lineIds.length === 0) {
    return {
      action: null,
      regenerateLineIds,
      generateLineIds,
      actionLineIds: [],
    };
  }

  const allRegenerate =
    regenerateLineIds.length === input.lineIds.length && generateLineIds.length === 0;

  if (allRegenerate) {
    return {
      action: "regenerate",
      regenerateLineIds,
      generateLineIds,
      actionLineIds: regenerateLineIds,
    };
  }

  return {
    action: "generate",
    regenerateLineIds,
    generateLineIds,
    actionLineIds: generateLineIds,
  };
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
  if (!hasLineEverBeenInvoiced(input)) return false;
  if (
    !hasExistingIoCoverage({
      vendor_io_id: input.vendor_io_id,
      active_vendor_io_id: input.active_vendor_io_id,
      vendor_io_document_number: input.vendor_io_document_number,
    })
  ) {
    return false;
  }

  if (input.regeneration_status === "pending_regeneration") return true;
  if (input.invoice_status === "draft" && Boolean(input.invoice_id)) return true;
  if (hasActiveFinanceOverride(input.finance_override_until ?? null)) return true;

  if (hasRegeneratableRevenue(input)) return true;

  if (isPartiallyInvoicedBillingStatus(billing)) return true;

  const ops = input.operational_status ?? "draft";
  if (["io_revised", "reopened", "partially_invoiced"].includes(ops)) return true;

  // Fully invoiced and locked — no invoice action until ungenerate / finance override.
  if (isFullyInvoicedBillingStatus(billing) && ops === "locked") return false;

  if (billing === "moved_to_billing" && Number(input.invoiced_amount ?? 0) > 0) {
    return true;
  }

  if (ops === "io_generated" && Number(input.invoiced_amount ?? 0) > 0) return true;

  return false;
}

/** Assignments grid checkbox — only rows that can actually be invoiced/regenerated now. */
export function isAssignmentInvoiceSelectable(
  input: RegenerationEligibilityInput
): boolean {
  const billing = input.billing_status ?? "draft";
  if (TERMINAL_BILLING.has(billing)) return false;

  const hasIo = hasExistingIoCoverage({
    vendor_io_id: input.vendor_io_id,
    active_vendor_io_id: input.active_vendor_io_id,
    vendor_io_document_number: input.vendor_io_document_number,
  });

  if (input.regeneration_status === "pending_regeneration") {
    if (!hasLineEverBeenInvoiced(input)) {
      return isLineFirstTimeInvoiceEligible(input);
    }
    return canRegenerateInvoice(input);
  }

  if (!hasIo) return false;

  if (!hasLineEverBeenInvoiced(input)) {
    return isLineFirstTimeInvoiceEligible(input);
  }

  const remaining = getRemainingRevenue(input);
  if (
    isFullyInvoicedBillingStatus(billing) &&
    remaining <= MONEY_EPSILON &&
    input.regeneration_status !== "pending_regeneration" &&
    !hasActiveFinanceOverride(input.finance_override_until ?? null)
  ) {
    return false;
  }

  return remaining > MONEY_EPSILON || canRegenerateInvoice(input);
}

export function canRegenerateInvoice(input: RegenerationEligibilityInput): boolean {
  const billing = input.billing_status ?? "draft";
  if (TERMINAL_BILLING.has(billing)) return false;

  const hasIo = hasExistingIoCoverage({
    vendor_io_id: input.vendor_io_id,
    active_vendor_io_id: input.active_vendor_io_id,
    vendor_io_document_number: input.vendor_io_document_number,
  });

  if (!hasIo && !hasInvoiceLinkage(input)) return false;

  if (hasRegeneratableRevenue(input)) return true;

  return isInvoiceLifecycleReopenable(input);
}

export function hasInvoiceLinkage(
  input: Pick<
    RegenerationEligibilityInput,
    "invoice_id" | "invoiced_amount" | "billing_status" | "regeneration_status"
  >
): boolean {
  if (input.invoice_id) return true;
  if (Number(input.invoiced_amount ?? 0) > MONEY_EPSILON) return true;
  if (
    input.regeneration_status === "pending_regeneration" &&
    hasLineEverBeenInvoiced(input)
  ) {
    return true;
  }
  if (isPartiallyInvoicedBillingStatus(input.billing_status ?? "")) {
    return Number(input.invoiced_amount ?? 0) > MONEY_EPSILON;
  }
  if (["invoiced", "partially_paid", "paid"].includes(input.billing_status ?? "")) {
    return hasLineEverBeenInvoiced(input);
  }
  return false;
}

export function enrichRegenerationEligibilityInput(
  input: RegenerationEligibilityInput,
  billingContext?: {
    pending_regeneration_invoice_id?: string | null;
    regeneration_status?: string | null;
    invoice_status?: string | null;
  } | null
): RegenerationEligibilityInput {
  if (billingContext?.regeneration_status !== "pending_regeneration") {
    return input;
  }

  const hasOverride = hasActiveFinanceOverride(input.finance_override_until ?? null);

  if (!hasLineEverBeenInvoiced(input) && !input.invoice_id && !hasOverride) {
    return input;
  }

  return {
    ...input,
    regeneration_status: "pending_regeneration",
    invoice_id: input.invoice_id ?? billingContext.pending_regeneration_invoice_id ?? null,
    invoice_status: input.invoice_status ?? billingContext.invoice_status ?? "draft",
  };
}

/** True when every selected line should rebuild on a pending-regeneration invoice. */
export function selectionRequiresRegenerateDialog(
  lineIds: string[],
  getRow: (lineId: string) => RegenerationEligibilityInput | null,
  billingContext?: {
    regeneration_status?: string | null;
  } | null
): boolean {
  if (billingContext?.regeneration_status !== "pending_regeneration") return false;
  return resolveInvoiceActionForSelection({ lineIds, getRow }).action === "regenerate";
}

export function resolveInvoiceActionLabel(input: {
  invoiceLineIds: string[];
  getRow: (lineId: string) => RegenerationEligibilityInput | null;
}): "generate" | "regenerate" | null {
  return resolveInvoiceActionForSelection({
    lineIds: input.invoiceLineIds,
    getRow: input.getRow,
  }).action;
}
