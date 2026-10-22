import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { asMetadataRecord } from "@/lib/commercial/client-original-currency";
import { approvedQuotationMutationError } from "@/lib/commercial-sync/rules";
import { parseProposalOptions } from "@/features/quotations/export/proposal-options";

export async function persistQuotationProposalOptions(supabase: SupabaseClient<Database>, quotationId: string, input: unknown, revision: string) {
  let options;
  try { if (!Array.isArray(input)) throw new Error("Invalid options"); options = parseProposalOptions(JSON.stringify(input)); }
  catch { return { ok: false as const, message: "Choose at least one creator in each option (up to 12 options)." }; }
  const {data: quotation, error} = await supabase.from("quotations").select("metadata, updated_at, status, is_archived").eq("id", quotationId).maybeSingle();
  if (error || !quotation) return {ok:false as const,message:"Quotation not found or unavailable."};
  const locked = approvedQuotationMutationError(quotation.status);
  if (locked) return locked;
  if (quotation.is_archived || quotation.status === "archived") return {ok:false as const,message:"Archived quotations cannot be edited."};
  if (quotation.updated_at !== revision) return {ok:false as const,message:"The quotation changed. Close and reopen the selector before saving options."};
  const {data: items,error: itemError} = await supabase.from("quotation_items").select("id").eq("quotation_id",quotationId);
  if (itemError) return {ok:false as const,message:"Could not verify quotation creators."};
  const allowed = new Set((items ?? []).map(item=>item.id));
  if (options.some(option=>option.itemIds.some(id=>!allowed.has(id)))) return {ok:false as const,message:"A selected creator was removed. Close and reopen the selector."};
  const metadata = {...asMetadataRecord(quotation.metadata), proposalOptions: options};
  const nextRevision = new Date().toISOString();
  const {data: updated,error: updateError} = await supabase.from("quotations").update({metadata,updated_at:nextRevision} as never).eq("id",quotationId).eq("updated_at",revision).eq("status",quotation.status).eq("is_archived",false).select("updated_at").maybeSingle();
  if (updateError || !updated) return {ok:false as const,message:"Options were not saved. The quotation may have changed; close and reopen the selector to retry."};
  return {ok:true as const,revision:updated.updated_at};
}
