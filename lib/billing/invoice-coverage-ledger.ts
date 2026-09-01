import type { SupabaseClient } from "@supabase/supabase-js";

import { roundMoney } from "@/lib/vat/calculations";

export type InvoiceCoverageGrain = {
  postIds?: string[];
  deliverableIds?: string[];
  lineIds?: string[];
};

export type InvoiceCoverageSums = {
  posts: Map<string, number>;
  deliverables: Map<string, number>;
  lines: Map<string, number>;
};

/**
 * Sums non-void invoice slices per operational grain.
 * excludeInvoiceId is used on ungenerate so this invoice’s preserved line items do not count.
 */
export async function loadInvoiceCoverageSums(
  supabase: SupabaseClient,
  grain: InvoiceCoverageGrain,
  options?: { excludeInvoiceId?: string }
): Promise<{ sums: InvoiceCoverageSums; error?: string }> {
  const sums: InvoiceCoverageSums = {
    posts: new Map(),
    deliverables: new Map(),
    lines: new Map(),
  };
  const seen = new Set<string>();

  const postIds = [...new Set(grain.postIds ?? [])];
  const deliverableIds = [...new Set(grain.deliverableIds ?? [])];
  const lineIds = [...new Set(grain.lineIds ?? [])];

  const select =
    "id, invoice_id, campaign_line_id, assignment_deliverable_id, assignment_post_schedule_id, revenue_before_vat, invoices!inner(id, status)";

  const batches: Array<{ column: string; ids: string[] }> = [
    { column: "assignment_post_schedule_id", ids: postIds },
    { column: "assignment_deliverable_id", ids: deliverableIds },
    { column: "campaign_line_id", ids: lineIds },
  ];

  for (const batch of batches) {
    if (batch.ids.length === 0) continue;
    const { data, error } = await supabase
      .from("invoice_line_items")
      .select(select)
      .in(batch.column, batch.ids);
    if (error) {
      return { sums, error: error.message };
    }
    addCoverageRows(sums, data ?? [], options?.excludeInvoiceId, seen);
  }

  return { sums };
}

function addCoverageRows(
  sums: InvoiceCoverageSums,
  rows: unknown[],
  excludeInvoiceId: string | undefined,
  seen: Set<string>
) {
  for (const row of rows) {
    const item = row as {
      id: string;
      invoice_id: string;
      campaign_line_id: string | null;
      assignment_deliverable_id: string | null;
      assignment_post_schedule_id: string | null;
      revenue_before_vat: number | null;
      invoices: { id: string; status: string } | { id: string; status: string }[] | null;
    };
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    if (excludeInvoiceId && item.invoice_id === excludeInvoiceId) continue;
    const invoice = Array.isArray(item.invoices) ? item.invoices[0] : item.invoices;
    if (!invoice || invoice.status === "void") continue;

    const amount = roundMoney(Number(item.revenue_before_vat ?? 0));
    if (item.assignment_post_schedule_id) {
      addAmount(sums.posts, item.assignment_post_schedule_id, amount);
      continue;
    }
    if (item.assignment_deliverable_id) {
      addAmount(sums.deliverables, item.assignment_deliverable_id, amount);
      continue;
    }
    if (item.campaign_line_id) {
      addAmount(sums.lines, item.campaign_line_id, amount);
    }
  }
}

function addAmount(map: Map<string, number>, id: string, amount: number) {
  map.set(id, roundMoney((map.get(id) ?? 0) + amount));
}
