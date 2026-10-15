import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { asMetadataRecord } from "@/lib/commercial/client-original-currency";
import { approvedQuotationMutationError } from "@/lib/commercial-sync/rules";
import { CREATOR_LIST_ORDER_KEY } from "@/lib/quotations/quotation-creator-order";

/** Caller supplies the existing authenticated, permission-checked staff client (RLS remains active). */
export async function saveQuotationCreatorOrder(supabase: SupabaseClient<Database>, quotationId: string, itemIds: unknown) {
  if (!Array.isArray(itemIds) || itemIds.length > 10000 || itemIds.some(id => typeof id !== "string" || !id.trim()) || new Set(itemIds).size !== itemIds.length) {
    return { ok: false as const, message: "Invalid creator order." };
  }
  const { data: quotation, error } = await supabase.from("quotations")
    .select("metadata, updated_at, status, is_archived").eq("id", quotationId).maybeSingle();
  if (error || !quotation) return { ok: false as const, message: error?.message ?? "Quotation not found." };
  const locked = approvedQuotationMutationError(quotation.status);
  if (locked) return locked;
  if (quotation.is_archived || quotation.status === "archived") return { ok: false as const, message: "Archived quotations cannot be reordered." };
  const { data: items, error: itemsError } = await supabase.from("quotation_items").select("id").eq("quotation_id", quotationId);
  if (itemsError) return { ok: false as const, message: itemsError.message };
  const known = new Set((items ?? []).map(item => item.id));
  if (itemIds.length && (itemIds.length !== known.size || itemIds.some(id => !known.has(id)))) {
    return { ok: false as const, message: "The creator list changed. Refresh the quotation and try again." };
  }
  const metadata = asMetadataRecord(quotation.metadata);
  if (itemIds.length) metadata[CREATOR_LIST_ORDER_KEY] = itemIds;
  else delete metadata[CREATOR_LIST_ORDER_KEY];
  const { data: updated, error: updateError } = await supabase.from("quotations")
    .update({ metadata, updated_at: new Date().toISOString() } as never)
    .eq("id", quotationId).eq("updated_at", quotation.updated_at).eq("status", quotation.status)
    .eq("is_archived", false).select("id").maybeSingle();
  if (updateError) return { ok: false as const, message: updateError.message };
  if (!updated) return { ok: false as const, message: "The quotation changed while saving. Refresh and try again." };
  return { ok: true as const };
}
