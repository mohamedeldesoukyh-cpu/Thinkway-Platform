import type { SupabaseClient } from "@supabase/supabase-js";

import {
  metadataWithClientWorkspaceDisplayPatch,
  readClientWorkspaceDisplayFlags,
  type ClientWorkspaceDisplayFlags,
} from "@/lib/commercial/client-original-currency";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

const EMPTY_FLAGS: ClientWorkspaceDisplayFlags = {
  showOriginalCurrency: false,
  hideCostAndFees: false,
};

export async function loadClientWorkspaceDisplayFlags(
  supabase: Supabase,
  input: { quotationId?: string | null; shortlistId?: string | null }
): Promise<ClientWorkspaceDisplayFlags> {
  let quotationId = input.quotationId?.trim() || null;
  const shortlistId = input.shortlistId?.trim() || null;
  let shortlistMetadata: unknown = null;

  if (shortlistId) {
    const { data, error } = await supabase.from("discovery_shortlists")
      .select("metadata, quotation_id").eq("id", shortlistId).maybeSingle();
    if (error) throw new Error(error.message);
    shortlistMetadata = data?.metadata;
    quotationId ??= data?.quotation_id ?? null;
    if (!quotationId) {
      const { data: linked, error: linkedError } = await supabase.from("quotations")
        .select("id").eq("shortlist_id", shortlistId).eq("is_archived", false)
        .neq("status", "archived").order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      if (linkedError) throw new Error(linkedError.message);
      quotationId = linked?.id ?? null;
    }
  }

  // The active quotation is authoritative, including OFF/default values.
  // OR-ing the shortlist's stale flags previously turned OFF back into ON.
  if (quotationId) {
    const { data, error } = await supabase
      .from("quotations")
      .select("metadata")
      .eq("id", quotationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return readClientWorkspaceDisplayFlags(data.metadata);
  }

  return shortlistId ? readClientWorkspaceDisplayFlags(shortlistMetadata) : EMPTY_FLAGS;
}

export async function loadClientShowOriginalCurrency(
  supabase: Supabase,
  input: { quotationId?: string | null; shortlistId?: string | null }
): Promise<boolean> {
  return (await loadClientWorkspaceDisplayFlags(supabase, input)).showOriginalCurrency;
}

export async function persistClientWorkspaceDisplayFlags(
  supabase: Supabase,
  input: {
    quotationId?: string | null;
    shortlistId?: string | null;
    patch: Partial<ClientWorkspaceDisplayFlags>;
  }
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

  // Copy the complete effective settings so changing either toggle repairs any
  // historical disagreement in the other toggle as well.
  let synchronizedPatch: ClientWorkspaceDisplayFlags;
  try {
    synchronizedPatch = {
      ...await loadClientWorkspaceDisplayFlags(supabase, { quotationId, shortlistId }),
      ...input.patch,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to load display settings." };
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
        metadata: metadataWithClientWorkspaceDisplayPatch(
          (data as { metadata?: unknown }).metadata,
          synchronizedPatch
        ),
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
        metadata: metadataWithClientWorkspaceDisplayPatch(
          (data as { metadata?: unknown }).metadata,
          synchronizedPatch
        ),
      } as never)
      .eq("id", shortlistId);
    if (updateError) return { ok: false, message: updateError.message };
  }

  return { ok: true, quotationId, shortlistId };
}

export async function persistClientShowOriginalCurrency(
  supabase: Supabase,
  input: { quotationId?: string | null; shortlistId?: string | null; value: boolean }
): Promise<{ ok: true; quotationId: string | null; shortlistId: string | null } | { ok: false; message: string }> {
  return persistClientWorkspaceDisplayFlags(supabase, {
    quotationId: input.quotationId,
    shortlistId: input.shortlistId,
    patch: { showOriginalCurrency: input.value },
  });
}
