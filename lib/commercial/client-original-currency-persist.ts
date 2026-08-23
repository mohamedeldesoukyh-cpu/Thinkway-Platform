import type { SupabaseClient } from "@supabase/supabase-js";

import {
  metadataWithShowOriginalCurrency,
  readShowOriginalCurrency,
} from "@/lib/commercial/client-original-currency";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export async function loadClientShowOriginalCurrency(
  supabase: Supabase,
  input: { quotationId?: string | null; shortlistId?: string | null }
): Promise<boolean> {
  const quotationId = input.quotationId?.trim() || null;
  const shortlistId = input.shortlistId?.trim() || null;

  if (quotationId) {
    const { data } = await supabase
      .from("quotations")
      .select("metadata")
      .eq("id", quotationId)
      .maybeSingle();
    if (readShowOriginalCurrency((data as { metadata?: unknown } | null)?.metadata)) return true;
  }

  if (shortlistId) {
    const { data } = await supabase
      .from("discovery_shortlists")
      .select("metadata")
      .eq("id", shortlistId)
      .maybeSingle();
    if (readShowOriginalCurrency((data as { metadata?: unknown } | null)?.metadata)) return true;
  }

  return false;
}

export async function persistClientShowOriginalCurrency(
  supabase: Supabase,
  input: { quotationId?: string | null; shortlistId?: string | null; value: boolean }
): Promise<{ ok: true; quotationId: string | null; shortlistId: string | null } | { ok: false; message: string }> {
  let quotationId = input.quotationId?.trim() || null;
  let shortlistId = input.shortlistId?.trim() || null;

  if (quotationId && !shortlistId) {
    const { data, error } = await supabase
      .from("quotations")
      .select("shortlist_id")
      .eq("id", quotationId)
      .maybeSingle();
    if (error) return { ok: false, message: error.message };
    shortlistId = (data as { shortlist_id?: string | null } | null)?.shortlist_id ?? null;
  }

  if (shortlistId && !quotationId) {
    const { data: shortlist, error: shortlistError } = await supabase
      .from("discovery_shortlists")
      .select("quotation_id")
      .eq("id", shortlistId)
      .maybeSingle();
    if (shortlistError) return { ok: false, message: shortlistError.message };
    quotationId = (shortlist as { quotation_id?: string | null } | null)?.quotation_id ?? null;
    if (!quotationId) {
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .select("id")
        .eq("shortlist_id", shortlistId)
        .eq("is_archived", false)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (quotationError) return { ok: false, message: quotationError.message };
      quotationId = (quotation as { id?: string } | null)?.id ?? null;
    }
  }

  if (!quotationId && !shortlistId) {
    return { ok: false, message: "Select a quotation or shortlist first." };
  }

  if (quotationId) {
    const { data, error } = await supabase
      .from("quotations")
      .select("metadata")
      .eq("id", quotationId)
      .maybeSingle();
    if (error || !data) return { ok: false, message: error?.message ?? "Quotation not found." };
    const { error: updateError } = await supabase
      .from("quotations")
      .update({
        metadata: metadataWithShowOriginalCurrency((data as { metadata?: unknown }).metadata, input.value),
      } as never)
      .eq("id", quotationId);
    if (updateError) return { ok: false, message: updateError.message };
  }

  if (shortlistId) {
    const { data, error } = await supabase
      .from("discovery_shortlists")
      .select("metadata")
      .eq("id", shortlistId)
      .maybeSingle();
    if (error || !data) return { ok: false, message: error?.message ?? "Shortlist not found." };
    const { error: updateError } = await supabase
      .from("discovery_shortlists")
      .update({
        metadata: metadataWithShowOriginalCurrency((data as { metadata?: unknown }).metadata, input.value),
      } as never)
      .eq("id", shortlistId);
    if (updateError) return { ok: false, message: updateError.message };
  }

  return { ok: true, quotationId, shortlistId };
}
