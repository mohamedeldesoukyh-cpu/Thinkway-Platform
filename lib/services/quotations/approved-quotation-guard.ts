import type { SupabaseClient } from "@supabase/supabase-js";

import {
  approvedQuotationMutationError,
  isApprovedQuotationCommercialHeaderPatch,
} from "@/lib/commercial-sync/rules";
import type { Database, QuotationStatus } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export async function loadQuotationStatus(
  supabase: Supabase,
  quotationId: string
): Promise<{ ok: true; status: QuotationStatus } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("quotations")
    .select("status")
    .eq("id", quotationId)
    .maybeSingle();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Quotation not found." };
  return { ok: true, status: (data as { status: QuotationStatus }).status };
}

export async function rejectIfApprovedQuotation(
  supabase: Supabase,
  quotationId: string
): Promise<{ ok: false; message: string } | null> {
  const loaded = await loadQuotationStatus(supabase, quotationId);
  if (!loaded.ok) return loaded;
  return approvedQuotationMutationError(loaded.status);
}

export async function rejectIfApprovedQuotationHeaderPatch(
  supabase: Supabase,
  quotationId: string,
  patch: Record<string, unknown>
): Promise<{ ok: false; message: string } | null> {
  const loaded = await loadQuotationStatus(supabase, quotationId);
  if (!loaded.ok) return loaded;
  if (!isApprovedQuotationCommercialHeaderPatch(patch)) return null;
  return approvedQuotationMutationError(loaded.status);
}
