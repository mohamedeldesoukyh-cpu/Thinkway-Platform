import type { SupabaseClient } from "@supabase/supabase-js";

/** Allocates invoice payments proportionally across linked deliverables. */
export async function syncDeliverableCollectionsForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<void> {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total, amount_paid")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return;

  const total = Number(invoice.total ?? 0);
  const amountPaid = Number(invoice.amount_paid ?? 0);
  if (total <= 0 || amountPaid <= 0) return;

  const collectionRatio = Math.min(1, amountPaid / total);

  const { data: items } = await supabase
    .from("invoice_line_items")
    .select("assignment_deliverable_id, revenue_before_vat, unit_price")
    .eq("invoice_id", invoiceId)
    .not("assignment_deliverable_id", "is", null);

  for (const item of items ?? []) {
    if (!item.assignment_deliverable_id) continue;
    const invoiced = Number(item.revenue_before_vat ?? item.unit_price ?? 0);
    const collected = Math.round(invoiced * collectionRatio * 100) / 100;
    const billingStatus =
      collected >= invoiced
        ? "collected"
        : collected > 0
          ? "partially_collected"
          : "invoiced";

    await supabase
      .from("assignment_deliverables")
      .update({
        collected_amount: collected,
        billing_status: billingStatus,
      })
      .eq("id", item.assignment_deliverable_id);
  }
}
