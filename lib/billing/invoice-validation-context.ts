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
