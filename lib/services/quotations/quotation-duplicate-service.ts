import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { insertQuotationHeaderRecord } from "./repositories/quotation-repository";
import { computeQuotationTotals } from "@/lib/commercial/quotation-engine";

/** Copy only commercial content. Identity, signatures, sharing and campaign links start fresh. */
export function quotationCopyHeader(source: Record<string, unknown>, itemIds: Map<string, string>) {
  const patch: Record<string, unknown> = {};
  for (const key of ["shortlist_id", "client_id", "brand_id", "currency", "notes", "terms", "department", "gp_target_pct",
    "is_temporary_client", "is_temporary_brand", "temporary_client_name", "temporary_brand_name"]) {
    if (source[key] !== undefined) patch[key] = source[key];
  }
  const meta = (source.metadata ?? {}) as Record<string, unknown>;
  patch.metadata = {
    showOriginalCurrency: meta.showOriginalCurrency === true,
    hideCostAndFees: meta.hideCostAndFees === true,
    ...(meta.showPackageVat === true ? { showPackageVat: true } : {}),
    creatorListOrder: Array.isArray(meta.creatorListOrder) ? meta.creatorListOrder.flatMap(id => itemIds.get(String(id)) ?? []) : [],
    templateCreatorPhotos: meta.templateCreatorPhotos ?? {},
  };
  return { ...patch, name: `${source.name} (Copy)`, status: "draft", campaign_header_id: null,
    version: "v1.0", version_number: 1, shared_with_client: false, client_visible: false, is_archived: false };
}

export function quotationCopyItems(items: Record<string, unknown>[], quotationId: string, itemIds: Map<string, string>) {
  const groups = new Map<string, string>();
  return items.map(row => {
    const { id, quotation_id: _quotation, created_at: _created, updated_at: _updated,
      source_shortlist_item_id: _source, ...content } = row;
    const group = row.collapse_group_id as string | null;
    if (group && !groups.has(group)) groups.set(group, crypto.randomUUID());
    return { ...content, id: itemIds.get(String(id)), quotation_id: quotationId,
      source_shortlist_item_id: null, ...(group ? { collapse_group_id: groups.get(group) } : {}) };
  });
}

export async function duplicateQuotationDocument(supabase: SupabaseClient<Database>, userId: string, quotationId: string, selectedItemIds?: string[]) {
  if (selectedItemIds !== undefined && (!Array.isArray(selectedItemIds) || !selectedItemIds.length)) {
    return { ok: false as const, message: "Select at least one creator or option." };
  }
  const source = await supabase.from("quotations").select("*").eq("id", quotationId).single();
  if (source.error || !source.data) return { ok: false as const, message: source.error?.message ?? "Quotation not found." };
  // Read every page before creating the copy; large quotations must never be truncated.
  let items: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase.from("quotation_items").select("*").eq("quotation_id", quotationId)
      .order("sort_order").order("id").range(offset, offset + 999);
    if (page.error) return { ok: false as const, message: page.error.message };
    items.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < 1000) break;
  }
  if (selectedItemIds !== undefined) {
    const selected = new Set(selectedItemIds);
    const picked = items.filter(item => selected.has(String(item.id)));
    if (picked.length !== selected.size) return { ok: false as const, message: "Some selected creators are no longer in this quotation. Refresh and select them again." };
    const groups = new Set(picked.map(item => item.collapse_group_id).filter(Boolean));
    if (items.some(item => groups.has(item.collapse_group_id) && !selected.has(String(item.id)))) {
      return { ok: false as const, message: "Select all creators in a combined package to copy its shared price." };
    }
    items = picked;
  }
  const ids = new Map(items.map(item => [String(item.id), crypto.randomUUID()]));
  const totals = computeQuotationTotals(items.map(item => ({ cost_egp: Number(item.cost_egp ?? 0),
    revenue_egp: Number(item.revenue_egp ?? 0), gp_value_egp: Number(item.gp_value_egp ?? 0), af_value_egp: Number(item.af_value_egp ?? 0) })));
  const created = await insertQuotationHeaderRecord(supabase, userId, {
    ...quotationCopyHeader(source.data, ids), status: "draft",
    ...(selectedItemIds !== undefined ? { name: `${source.data.name} (New option)` } : {}),
    total_cost_egp: totals.totalCostEgp, total_revenue_egp: totals.totalRevenueEgp,
    total_gp_value_egp: totals.totalGpValueEgp, total_gp_pct: totals.totalGpPct,
    total_af_egp: totals.totalAfValueEgp, total_agency_margin_egp: totals.totalAgencyMarginEgp,
  });
  if (created.error || !created.data) return { ok: false as const, message: created.error?.message ?? "Could not create the copy." };
  const id = created.data.id;
  try {
    if (items.length) {
      const copied = await supabase.from("quotation_items").insert(quotationCopyItems(items, id, ids) as never);
      if (copied.error) throw new Error(copied.error.message);
    }
  } catch (error) {
    // Compensate only the new draft; never touch the source quotation.
    const cleanup = await supabase.from("quotations").delete().eq("id", id);
    return { ok: false as const, message: cleanup.error
      ? `Copy incomplete (${id}). Please archive it before retrying.`
      : `Could not copy creators: ${error instanceof Error ? error.message : "Please retry."}` };
  }
  return { ok: true as const, data: { id }, message: selectedItemIds !== undefined ? "New quotation option created from your selection." : "Quotation duplicated as a new draft." };
}
