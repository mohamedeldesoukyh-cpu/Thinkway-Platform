import type { SupabaseClient } from "@supabase/supabase-js";

import {
  recalculateInvoiceTotals,
  resolveInvoiceDeliverableIds,
} from "@/lib/billing/invoice-from-deliverables";

/** Regeneration / invoice repair must never include assignments without Vendor IO. */
export async function filterIoGatedCampaignLineIds(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<string[]> {
  if (lineIds.length === 0) return [];

  const { data, error } = await supabase
    .from("campaign_lines")
    .select("id, vendor_io_id")
    .in("id", lineIds);

  if (error) return [];

  return (data ?? [])
    .filter((row) => Boolean((row as { vendor_io_id: string | null }).vendor_io_id))
    .map((row) => (row as { id: string }).id);
}

async function resetLineAfterInvoiceScopeRemoval(
  supabase: SupabaseClient,
  lineIds: string[]
): Promise<void> {
  if (lineIds.length === 0) return;

  const { data: rows } = await supabase
    .from("campaign_lines")
    .select("id, vendor_io_id")
    .in("id", lineIds);

  const withIo: string[] = [];
  const withoutIo: string[] = [];

  for (const row of rows ?? []) {
    const typed = row as { id: string; vendor_io_id: string | null };
    if (typed.vendor_io_id) withIo.push(typed.id);
    else withoutIo.push(typed.id);
  }

  if (withIo.length > 0) {
    await supabase
      .from("campaign_lines")
      .update({
        invoice_id: null,
        billing_invoiced_at: null,
        revenue_locked: false,
        cost_locked: false,
        vendor_assignment_locked: false,
        vat_locked: false,
        operational_status: "io_generated",
        billing_status: "moved_to_billing",
      } as never)
      .in("id", withIo);
  }

  if (withoutIo.length > 0) {
    await supabase
      .from("campaign_lines")
      .update({
        invoice_id: null,
        billing_invoiced_at: null,
        revenue_locked: false,
        cost_locked: false,
        vendor_assignment_locked: false,
        vat_locked: false,
        operational_status: "draft",
        billing_status: "approved",
      } as never)
      .in("id", withoutIo);
  }
}

export async function resolveUserRegenerationSelection(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  input: {
    lineIds: string[];
    deliverableIds: string[];
  }
): Promise<{ lineIds: string[]; deliverableIds: string[]; error?: string }> {
  if (input.lineIds.length === 0 && input.deliverableIds.length === 0) {
    return { lineIds: [], deliverableIds: [] };
  }

  const { deliverableIds, error } = await resolveInvoiceDeliverableIds(
    supabase,
    campaignHeaderId,
    input.deliverableIds,
    input.lineIds,
    { forRegeneration: true }
  );

  if (error) {
    return { lineIds: [], deliverableIds: [], error };
  }

  return {
    lineIds: [...new Set(input.lineIds)],
    deliverableIds,
  };
}

/** Remove invoice linkage from assignments outside the regeneration scope. */
export async function clearStaleInvoiceLinksOutsideScope(
  supabase: SupabaseClient,
  invoiceId: string,
  allowedLineIds: string[]
): Promise<void> {
  const allowed = new Set(allowedLineIds);
  if (allowed.size === 0) return;

  const { data: linkedLines } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("invoice_id", invoiceId);

  const staleLineIds = (linkedLines ?? [])
    .map((row) => (row as { id: string }).id)
    .filter((lineId) => !allowed.has(lineId));

  if (staleLineIds.length > 0) {
    await resetLineAfterInvoiceScopeRemoval(supabase, staleLineIds);
  }

  const { data: lineItems } = await supabase
    .from("invoice_line_items")
    .select("id, campaign_line_id")
    .eq("invoice_id", invoiceId);

  const staleItemIds = (lineItems ?? [])
    .filter((row) => {
      const lineId = (row as { campaign_line_id: string | null }).campaign_line_id;
      return lineId && !allowed.has(lineId);
    })
    .map((row) => (row as { id: string }).id);

  if (staleItemIds.length > 0) {
    await supabase.from("invoice_line_items").delete().in("id", staleItemIds);
    await recalculateInvoiceTotals(supabase, invoiceId);
  }
}

/** Drops invoice rows for assignments that never received Vendor IO. */
export async function pruneNonIoInvoiceLineItems(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<{ removedLineIds: string[] }> {
  const { data: items } = await supabase
    .from("invoice_line_items")
    .select("id, campaign_line_id")
    .eq("invoice_id", invoiceId);

  const lineIds = [
    ...new Set(
      (items ?? [])
        .map((row) => (row as { campaign_line_id: string | null }).campaign_line_id)
        .filter(Boolean) as string[]
    ),
  ];

  if (lineIds.length === 0) {
    return { removedLineIds: [] };
  }

  const ioGated = new Set(await filterIoGatedCampaignLineIds(supabase, lineIds));
  const staleItemIds = (items ?? [])
    .filter((row) => {
      const lineId = (row as { campaign_line_id: string | null }).campaign_line_id;
      return lineId && !ioGated.has(lineId);
    })
    .map((row) => (row as { id: string }).id);

  const removedLineIds = [
    ...new Set(
      (items ?? [])
        .filter((row) => {
          const lineId = (row as { campaign_line_id: string | null }).campaign_line_id;
          return lineId && !ioGated.has(lineId);
        })
        .map((row) => (row as { campaign_line_id: string }).campaign_line_id)
    ),
  ];

  if (staleItemIds.length === 0) {
    return { removedLineIds: [] };
  }

  await supabase.from("invoice_line_items").delete().in("id", staleItemIds);
  await resetLineAfterInvoiceScopeRemoval(supabase, removedLineIds);
  await recalculateInvoiceTotals(supabase, invoiceId);

  return { removedLineIds };
}
