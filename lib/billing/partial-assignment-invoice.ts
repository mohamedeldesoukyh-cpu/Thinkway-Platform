/**
 * Amount / percent slices for partial assignment invoicing.
 * Spec: docs/capabilities/PARTIAL_ASSIGNMENT_INVOICE_SPEC.md
 */

import { computeVatLine, roundMoney } from "@/lib/vat/calculations";

export const INVOICE_SLICE_EPSILON = 0.01;

export type InvoiceSliceGrain = "assignment" | "deliverable" | "post";

export type InvoiceSliceAllocationKey = `${InvoiceSliceGrain}:${string}`;

export type InvoiceSliceRequest = {
  remaining: number;
  billable?: number;
  invoiced?: number;
  requestedAmount?: number | null;
  requestedPercent?: number | null;
  vatPercent?: number;
  vatExempt?: boolean;
};

export type InvoiceSliceResult = {
  billedAmount: number;
  percentOfRemaining: number;
  remainingAfter: number;
  invoicedAfter: number;
  vatAmount: number;
  afterVat: number;
  billingStatus: "ready_to_invoice" | "partially_invoiced" | "invoiced";
  shouldLock: boolean;
  error?: string;
};

export function invoiceSliceKey(kind: InvoiceSliceGrain, id: string): InvoiceSliceAllocationKey {
  return `${kind}:${id}`;
}

export function parseInvoiceSliceKey(
  key: string
): { kind: InvoiceSliceGrain; id: string } | null {
  const match = /^(assignment|deliverable|post):([0-9a-f-]{36})$/i.exec(key.trim());
  if (!match) return null;
  return { kind: match[1] as InvoiceSliceGrain, id: match[2]! };
}

export function parseInvoiceSliceAllocations(raw: string | null | undefined): {
  allocations: Map<InvoiceSliceAllocationKey, number>;
  error?: string;
} {
  const allocations = new Map<InvoiceSliceAllocationKey, number>();
  if (!raw?.trim()) return { allocations };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { allocations, error: "Invoice amounts are invalid." };
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { allocations, error: "Invoice amounts are invalid." };
  }

  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    const parsedKey = parseInvoiceSliceKey(key);
    if (!parsedKey) {
      return { allocations, error: "Invoice amounts include an unknown row." };
    }
    const amount = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      return { allocations, error: "Invoice amounts must be zero or greater." };
    }
    allocations.set(invoiceSliceKey(parsedKey.kind, parsedKey.id), roundMoney(amount));
  }

  return { allocations };
}

export function serializeInvoiceSliceAllocations(
  allocations: Map<string, number> | Record<string, number>
): string {
  const record =
    allocations instanceof Map ? Object.fromEntries(allocations.entries()) : allocations;
  return JSON.stringify(record);
}

export function percentFromAmount(remaining: number, amount: number): number {
  const cap = roundMoney(Math.max(0, remaining));
  const billed = roundMoney(Math.max(0, amount));
  if (cap <= INVOICE_SLICE_EPSILON) return billed > 0 ? 100 : 0;
  return roundMoney((billed / cap) * 100);
}

export function amountFromPercent(remaining: number, percent: number): number {
  const cap = roundMoney(Math.max(0, remaining));
  const pct = Math.max(0, percent);
  if (pct >= 100) return cap;
  return roundMoney((cap * pct) / 100);
}

/**
 * Resolve a billed slice. Percent and amount are of remaining.
 * Missing request = 100% of remaining (legacy full invoice).
 */
export function resolveInvoiceSlice(input: InvoiceSliceRequest): InvoiceSliceResult {
  const remaining = roundMoney(Math.max(0, input.remaining));
  const invoiced = roundMoney(Math.max(0, input.invoiced ?? 0));
  const billable = roundMoney(
    Math.max(remaining + invoiced, Math.max(0, input.billable ?? remaining + invoiced))
  );

  const empty: InvoiceSliceResult = {
    billedAmount: 0,
    percentOfRemaining: 0,
    remainingAfter: remaining,
    invoicedAfter: invoiced,
    vatAmount: 0,
    afterVat: 0,
    billingStatus: coverageBillingStatus(invoiced, remaining),
    shouldLock: remaining <= INVOICE_SLICE_EPSILON && invoiced > INVOICE_SLICE_EPSILON,
  };

  if (remaining <= INVOICE_SLICE_EPSILON) {
    return { ...empty, error: "Nothing remaining to invoice on this row." };
  }

  let billed: number;
  if (input.requestedAmount != null && Number.isFinite(input.requestedAmount)) {
    billed = roundMoney(Math.max(0, input.requestedAmount));
  } else if (input.requestedPercent != null && Number.isFinite(input.requestedPercent)) {
    billed = amountFromPercent(remaining, input.requestedPercent);
  } else {
    billed = remaining;
  }

  if (billed <= INVOICE_SLICE_EPSILON) {
    return { ...empty, error: "Invoice amount must be greater than zero." };
  }

  if (billed > remaining + INVOICE_SLICE_EPSILON) {
    return {
      ...empty,
      error: "Invoice amount cannot exceed remaining assignment revenue.",
    };
  }

  if (billed >= remaining - INVOICE_SLICE_EPSILON) {
    billed = remaining;
  }

  const invoicedAfter = roundMoney(invoiced + billed);
  if (invoicedAfter > billable + INVOICE_SLICE_EPSILON) {
    return {
      ...empty,
      error: "Invoice amount cannot exceed the assignment total.",
    };
  }

  const remainingAfter = roundMoney(Math.max(0, billable - invoicedAfter));
  const vat = computeVatLine({
    beforeVat: billed,
    vatPercent: input.vatPercent ?? 0,
    exempt: Boolean(input.vatExempt),
  });

  return {
    billedAmount: billed,
    percentOfRemaining: percentFromAmount(remaining, billed),
    remainingAfter,
    invoicedAfter: roundMoney(Math.min(billable, invoicedAfter)),
    vatAmount: vat.vatAmount,
    afterVat: vat.afterVat,
    billingStatus: coverageBillingStatus(invoicedAfter, remainingAfter),
    shouldLock: remainingAfter <= INVOICE_SLICE_EPSILON,
  };
}

export function coverageBillingStatus(
  invoiced: number,
  remaining: number
): InvoiceSliceResult["billingStatus"] {
  if (roundMoney(remaining) <= INVOICE_SLICE_EPSILON && roundMoney(invoiced) > INVOICE_SLICE_EPSILON) {
    return "invoiced";
  }
  if (roundMoney(invoiced) > INVOICE_SLICE_EPSILON) {
    return "partially_invoiced";
  }
  return "ready_to_invoice";
}

export function applyCoverageToLedger(input: {
  billable: number;
  invoicedCoverage: number;
}): {
  invoiced: number;
  remaining: number;
  billingStatus: InvoiceSliceResult["billingStatus"];
  shouldLock: boolean;
} {
  const billable = roundMoney(Math.max(0, input.billable));
  const invoiced = roundMoney(Math.min(billable, Math.max(0, input.invoicedCoverage)));
  const remaining = roundMoney(Math.max(0, billable - invoiced));
  return {
    invoiced,
    remaining,
    billingStatus: coverageBillingStatus(invoiced, remaining),
    shouldLock: remaining <= INVOICE_SLICE_EPSILON && invoiced > INVOICE_SLICE_EPSILON,
  };
}

/** Operational row patch after coverage is known. Partial never schedule-locks. */
export function buildOperationalCoveragePatch(input: {
  billable: number;
  invoicedCoverage: number;
  lineItemId: string | null;
  now: string;
  lockLiveDate: boolean;
}): Record<string, unknown> {
  const coverage = applyCoverageToLedger(input);
  const patch: Record<string, unknown> = {
    invoiced_amount: coverage.invoiced,
    remaining_amount: coverage.remaining,
    billing_status: coverage.billingStatus,
    invoice_line_item_id: coverage.invoiced > INVOICE_SLICE_EPSILON ? input.lineItemId : null,
    invoiced_at: coverage.invoiced > INVOICE_SLICE_EPSILON ? input.now : null,
  };
  if (coverage.shouldLock && input.lockLiveDate) {
    patch.locked_at = input.now;
  } else if (!coverage.shouldLock) {
    patch.locked_at = null;
  }
  return patch;
}

/** Split an assignment-level slice across children by remaining share. Last child takes leftover. */
export function allocateSliceAcrossRemaining(
  totalSlice: number,
  children: Array<{ id: string; remaining: number }>
): Map<string, number> {
  const shares = new Map<string, number>();
  const eligible = children.filter((child) => roundMoney(child.remaining) > INVOICE_SLICE_EPSILON);
  if (eligible.length === 0) return shares;

  const slice = roundMoney(Math.max(0, totalSlice));
  const remainingTotal = roundMoney(
    eligible.reduce((sum, child) => sum + roundMoney(Math.max(0, child.remaining)), 0)
  );
  const capped = Math.min(slice, remainingTotal);
  if (capped <= INVOICE_SLICE_EPSILON) return shares;

  let allocated = 0;
  for (let index = 0; index < eligible.length; index++) {
    const child = eligible[index]!;
    const childRemaining = roundMoney(Math.max(0, child.remaining));
    const isLast = index === eligible.length - 1;
    const share = isLast
      ? roundMoney(Math.min(childRemaining, capped - allocated))
      : roundMoney(Math.min(childRemaining, (childRemaining / remainingTotal) * capped));
    shares.set(child.id, share);
    allocated = roundMoney(allocated + share);
  }

  return shares;
}

/**
 * When create sends assignment:lineId amounts but the server expanded to
 * deliverable/post rows, split the assignment slice across remaining children.
 * Existing child keys win so mixed percents are not overwritten.
 */
export function spreadLineAllocationsToChildren(
  billedByLineId: Map<string, number> | undefined,
  children: Array<{ id: string; lineId: string; remaining: number }>,
  existing: Map<string, number>
): Map<string, number> {
  const next = new Map(existing);
  if (!billedByLineId || billedByLineId.size === 0) return next;

  const byLine = new Map<string, Array<{ id: string; remaining: number }>>();
  for (const child of children) {
    const list = byLine.get(child.lineId) ?? [];
    list.push({ id: child.id, remaining: child.remaining });
    byLine.set(child.lineId, list);
  }

  for (const [lineId, slice] of billedByLineId) {
    const rows = byLine.get(lineId);
    if (!rows || rows.length === 0) continue;
    const shares = allocateSliceAcrossRemaining(slice, rows);
    for (const [id, amount] of shares) {
      if (!next.has(id)) next.set(id, amount);
    }
  }

  return next;
}

export function resolveBilledAmountForRow(input: {
  id: string;
  kind: InvoiceSliceGrain;
  remaining: number;
  allocations: Map<string, number>;
}): InvoiceSliceResult {
  const requested = input.allocations.get(invoiceSliceKey(input.kind, input.id));
  return resolveInvoiceSlice({
    remaining: input.remaining,
    requestedAmount: requested == null ? input.remaining : requested,
  });
}
