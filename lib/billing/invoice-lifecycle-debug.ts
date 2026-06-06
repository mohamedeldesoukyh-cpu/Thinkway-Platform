import type { SupabaseClient } from "@supabase/supabase-js";

import { devLog } from "@/lib/dev-log";

const DEBUG_SCOPE = "invoice-lifecycle-debug";

export type InvoiceLineItemDebugRow = {
  id: string;
  campaign_line_id: string | null;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  revenue_before_vat: number;
  revenue_vat_amount: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
};

export type InvoiceTotalsDebug = {
  subtotal: number;
  tax_amount: number;
  total: number;
  revenue_before_vat: number;
  revenue_vat_amount: number;
  revenue_after_vat: number;
};

export type AssignmentStatusDebug = {
  id: string;
  document_number: string | null;
  billing_status: string;
  operational_status: string | null;
  invoice_id: string | null;
};

export type InvoiceLineItemOpSummary = {
  updated: string[];
  created: string[];
};

export type InvoiceLifecycleDebugSnapshot = {
  totals: InvoiceTotalsDebug | null;
  lineItems: InvoiceLineItemDebugRow[];
  lineItemCount: number;
  duplicatePostLinks: Array<{ post_id: string; count: number; line_item_ids: string[] }>;
  duplicateDeliverableLinks: Array<{ deliverable_id: string; count: number; line_item_ids: string[] }>;
  assignmentStatuses: AssignmentStatusDebug[];
};

function isDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development";
}

/** Temporary append/regenerate instrumentation — remove after lifecycle verification. */
export function logInvoiceLifecycleDebug(
  phase: string,
  detail: Record<string, unknown>
): void {
  if (!isDebugEnabled()) return;
  devLog(`${DEBUG_SCOPE} ${phase}`, detail);
}

export async function captureInvoiceLifecycleSnapshot(
  supabase: SupabaseClient,
  invoiceId: string,
  lineIds: string[] = []
): Promise<InvoiceLifecycleDebugSnapshot> {
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "subtotal, tax_amount, total, revenue_before_vat, revenue_vat_amount, revenue_after_vat"
    )
    .eq("id", invoiceId)
    .maybeSingle();

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select(
      "id, campaign_line_id, assignment_deliverable_id, assignment_post_schedule_id, revenue_before_vat, revenue_vat_amount, unit_price, line_total, sort_order"
    )
    .eq("invoice_id", invoiceId)
    .order("sort_order");

  const mappedItems: InvoiceLineItemDebugRow[] = (lineItems ?? []).map((row) => {
    const item = row as InvoiceLineItemDebugRow;
    return {
      id: item.id,
      campaign_line_id: item.campaign_line_id ?? null,
      assignment_deliverable_id: item.assignment_deliverable_id ?? null,
      assignment_post_schedule_id: item.assignment_post_schedule_id ?? null,
      revenue_before_vat: Number(item.revenue_before_vat ?? 0),
      revenue_vat_amount: Number(item.revenue_vat_amount ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      line_total: Number(item.line_total ?? 0),
      sort_order: Number(item.sort_order ?? 0),
    };
  });

  const duplicatePostLinks = findDuplicatePostLinks(mappedItems);
  const duplicateDeliverableLinks = findDuplicateDeliverableLinks(mappedItems);

  let assignmentStatuses: AssignmentStatusDebug[] = [];
  if (lineIds.length > 0) {
    const { data: assignments } = await supabase
      .from("campaign_lines")
      .select("id, document_number, billing_status, operational_status, invoice_id")
      .in("id", lineIds);

    assignmentStatuses = (assignments ?? []).map((row) => {
      const line = row as AssignmentStatusDebug;
      return {
        id: line.id,
        document_number: line.document_number ?? null,
        billing_status: line.billing_status,
        operational_status: line.operational_status ?? null,
        invoice_id: line.invoice_id ?? null,
      };
    });
  }

  const inv = invoice as InvoiceTotalsDebug | null;

  return {
    totals: inv
      ? {
          subtotal: Number(inv.subtotal ?? 0),
          tax_amount: Number(inv.tax_amount ?? 0),
          total: Number(inv.total ?? 0),
          revenue_before_vat: Number(inv.revenue_before_vat ?? 0),
          revenue_vat_amount: Number(inv.revenue_vat_amount ?? 0),
          revenue_after_vat: Number(inv.revenue_after_vat ?? 0),
        }
      : null,
    lineItems: mappedItems,
    lineItemCount: mappedItems.length,
    duplicatePostLinks,
    duplicateDeliverableLinks,
    assignmentStatuses,
  };
}

function findDuplicatePostLinks(
  items: InvoiceLineItemDebugRow[]
): Array<{ post_id: string; count: number; line_item_ids: string[] }> {
  const byKey = new Map<string, string[]>();

  for (const item of items) {
    const key = item.assignment_post_schedule_id;
    if (!key) continue;
    const existing = byKey.get(key) ?? [];
    existing.push(item.id);
    byKey.set(key, existing);
  }

  const duplicates: Array<{ post_id: string; count: number; line_item_ids: string[] }> = [];
  for (const [key, ids] of byKey) {
    if (ids.length <= 1) continue;
    duplicates.push({ post_id: key, count: ids.length, line_item_ids: ids });
  }
  return duplicates;
}

function findDuplicateDeliverableLinks(
  items: InvoiceLineItemDebugRow[]
): Array<{ deliverable_id: string; count: number; line_item_ids: string[] }> {
  const byKey = new Map<string, string[]>();

  for (const item of items) {
    const key = item.assignment_deliverable_id;
    if (!key) continue;
    const existing = byKey.get(key) ?? [];
    existing.push(item.id);
    byKey.set(key, existing);
  }

  const duplicates: Array<{ deliverable_id: string; count: number; line_item_ids: string[] }> =
    [];
  for (const [key, ids] of byKey) {
    if (ids.length <= 1) continue;
    duplicates.push({ deliverable_id: key, count: ids.length, line_item_ids: ids });
  }
  return duplicates;
}

export function summarizeLineItemOps(
  ops: InvoiceLineItemOpSummary | undefined
): Record<string, unknown> {
  if (!ops) {
    return { updated_count: 0, created_count: 0, updated_ids: [], created_ids: [] };
  }
  return {
    updated_count: ops.updated.length,
    created_count: ops.created.length,
    updated_ids: ops.updated,
    created_ids: ops.created,
  };
}

export function logInvoiceLifecycleTransition(input: {
  flow: "append" | "new" | "regenerate";
  phase: string;
  invoiceId: string;
  invoiceDocumentNumber?: string;
  touchedLineIds?: string[];
  before?: InvoiceLifecycleDebugSnapshot | null;
  after?: InvoiceLifecycleDebugSnapshot | null;
  lineItemOps?: InvoiceLineItemOpSummary;
  recalculateError?: string | null;
  lockResolvedLineIds?: string[];
  usedFallbackLineLock?: boolean;
}): void {
  if (!isDebugEnabled()) return;

  logInvoiceLifecycleDebug(input.phase, {
    flow: input.flow,
    invoiceId: input.invoiceId,
    invoiceDocumentNumber: input.invoiceDocumentNumber,
    touchedLineIds: input.touchedLineIds ?? [],
    totals_before: input.before?.totals ?? null,
    totals_after: input.after?.totals ?? null,
    line_items_before: input.before?.lineItems ?? [],
    line_items_after: input.after?.lineItems ?? [],
    line_item_count_before: input.before?.lineItemCount ?? 0,
    line_item_count_after: input.after?.lineItemCount ?? 0,
    ...summarizeLineItemOps(input.lineItemOps),
    recalculate_error: input.recalculateError ?? null,
    assignment_status_before: input.before?.assignmentStatuses ?? [],
    assignment_status_after: input.after?.assignmentStatuses ?? [],
    lock_resolved_line_ids: input.lockResolvedLineIds ?? [],
    used_fallback_line_lock: input.usedFallbackLineLock ?? false,
    duplicate_post_links_after: input.after?.duplicatePostLinks ?? [],
    duplicate_deliverable_links_after: input.after?.duplicateDeliverableLinks ?? [],
    has_duplicate_line_items:
      (input.after?.duplicatePostLinks.length ?? 0) > 0 ||
      (input.after?.duplicateDeliverableLinks.length ?? 0) > 0,
  });
}
