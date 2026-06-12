import {
  resolveClientBillableAmount,
  resolveClientRemainingAmount,
} from "@/lib/billing/client-billable-amount";

export type InvoiceBillingMode = "new" | "append";

export type InvoiceValidationContext = {
  mode: InvoiceBillingMode;
  targetInvoiceId?: string;
};

export function parseInvoiceBillingMode(raw: string | undefined): InvoiceBillingMode {
  return raw === "append" ? "append" : "new";
}

export function buildInvoiceValidationContext(input: {
  mode: InvoiceBillingMode;
  targetInvoiceId?: string;
}): InvoiceValidationContext {
  return {
    mode: input.mode,
    targetInvoiceId:
      input.mode === "append" ? input.targetInvoiceId?.trim() || undefined : undefined,
  };
}

export function isInvoicedOperationalRow(row: {
  locked_at?: string | null;
  invoice_line_item_id?: string | null;
}): boolean {
  return Boolean(row.locked_at || row.invoice_line_item_id);
}

/** Already-invoiced rows are allowed only when reopening/appending to the same invoice. */
export function invoicedRowAllowed(
  row: {
    locked_at?: string | null;
    invoice_line_item_id?: string | null;
    linked_invoice_id?: string | null;
  },
  ctx: InvoiceValidationContext
): boolean {
  if (!isInvoicedOperationalRow(row)) return true;
  if (ctx.mode === "append" && ctx.targetInvoiceId) {
    if (!row.linked_invoice_id) return true;
    return row.linked_invoice_id === ctx.targetInvoiceId;
  }
  return false;
}

/** Row points at a line item on a non-void invoice (matches resolve-operational-invoice). */
export function isLinkedToLiveInvoiceLineItem(
  row: { invoice_line_item_id?: string | null },
  activeLineItemIds: Set<string>
): boolean {
  return Boolean(
    row.invoice_line_item_id && activeLineItemIds.has(row.invoice_line_item_id)
  );
}

export type OperationalInvoiceRowFields = {
  revenue_before_vat?: number | null;
  billable_amount?: number | null;
  invoiced_amount?: number | null;
  remaining_amount?: number | null;
  locked_at?: string | null;
  invoice_line_item_id?: string | null;
};

/** Remaining billable for invoice validation — matches UI linkage + commercial sync. */
export function resolveOperationalRemainingForInvoice(
  row: OperationalInvoiceRowFields,
  activeLineItemIds: Set<string>
): number {
  const stalePointer =
    isInvoicedOperationalRow(row) &&
    !isLinkedToLiveInvoiceLineItem(row, activeLineItemIds);

  if (stalePointer) {
    const billable = resolveClientBillableAmount(row);
    const invoiced = Number(row.invoiced_amount ?? 0);
    return Math.max(0, billable - invoiced);
  }

  const billable = resolveClientBillableAmount(row);
  const invoiced = Number(row.invoiced_amount ?? 0);
  const storedRemaining = Number(row.remaining_amount ?? NaN);

  if (
    isLinkedToLiveInvoiceLineItem(row, activeLineItemIds) &&
    Number.isFinite(storedRemaining) &&
    storedRemaining > 0.01
  ) {
    return Math.max(storedRemaining, Math.max(0, billable - invoiced));
  }

  return resolveClientRemainingAmount(row);
}

/** Block new invoice only when no remaining billable after sync, or fully on a live invoice. */
export function blocksNewInvoiceOperationalRow(
  row: OperationalInvoiceRowFields,
  activeLineItemIds: Set<string>
): boolean {
  const remaining = resolveOperationalRemainingForInvoice(row, activeLineItemIds);
  if (remaining > 0.01) return false;

  if (isLinkedToLiveInvoiceLineItem(row, activeLineItemIds)) {
    return true;
  }

  return resolveClientBillableAmount(row) <= 0.01;
}

export function invoicedRowBlockMessage(
  kind: "post" | "deliverable",
  ctx: InvoiceValidationContext
): string {
  if (ctx.mode === "append") {
    return "Selected rows include items invoiced on a different invoice.";
  }
  return kind === "post"
    ? "Selected post rows include already invoiced items."
    : "Selected deliverables include already invoiced items.";
}

/** Line item ids whose parent invoice is not void. */
export async function loadActiveInvoiceLineItemIds(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  lineItemIds: string[]
): Promise<Set<string>> {
  const active = new Set<string>();
  if (lineItemIds.length === 0) return active;

  const { data: items } = await supabase
    .from("invoice_line_items")
    .select("id, invoice_id")
    .in("id", lineItemIds);

  const invoiceIds = [
    ...new Set(
      (items ?? [])
        .map((row) => (row as { invoice_id: string | null }).invoice_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (invoiceIds.length === 0) return active;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status")
    .in("id", invoiceIds);

  const liveInvoiceIds = new Set(
    (invoices ?? [])
      .filter((row) => (row as { status: string }).status !== "void")
      .map((row) => (row as { id: string }).id)
  );

  for (const item of items ?? []) {
    const row = item as { id: string; invoice_id: string | null };
    if (row.invoice_id && liveInvoiceIds.has(row.invoice_id)) {
      active.add(row.id);
    }
  }

  return active;
}

export async function resolveLinkedInvoiceIds(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  lineItemIds: string[]
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(lineItemIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (uniqueIds.length === 0) return map;

  const { data, error } = await supabase
    .from("invoice_line_items")
    .select("id, invoice_id")
    .in("id", uniqueIds);

  if (error) {
    return map;
  }

  for (const row of data ?? []) {
    const item = row as { id: string; invoice_id: string };
    if (item.id && item.invoice_id) {
      map.set(item.id, item.invoice_id);
    }
  }

  return map;
}
