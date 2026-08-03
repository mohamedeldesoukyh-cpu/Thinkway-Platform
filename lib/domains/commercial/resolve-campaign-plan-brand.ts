import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Resolve a master-data brand for Campaign Plan → Campaign Workspace handoff.
 * Order: explicit id → quotation/shortlist workspace → planning facts brand name.
 */
export async function resolveCampaignPlanBrandId(
  supabase: SupabaseClient<Database>,
  input: {
    brandId?: string | null;
    conversationId?: string | null;
    brandNameHint?: string | null;
  }
): Promise<string | null> {
  if (input.brandId?.trim()) return input.brandId.trim();

  if (input.conversationId) {
    const fromWorkspace = await resolveBrandIdFromConversation(
      supabase,
      input.conversationId
    );
    if (fromWorkspace) return fromWorkspace;
  }

  return resolveBrandIdByName(supabase, input.brandNameHint);
}

async function resolveBrandIdFromConversation(
  supabase: SupabaseClient<Database>,
  conversationId: string
): Promise<string | null> {
  const { data: conversation, error } = await supabase
    .from("ai_conversations")
    .select("workspace_type, workspace_id")
    .eq("id", conversationId)
    .maybeSingle();

  const row = conversation as {
    workspace_type?: string;
    workspace_id?: string | null;
  } | null;

  if (error || !row?.workspace_id) return null;

  if (row.workspace_type === "quotation") {
    const { data: quotation } = await supabase
      .from("quotations")
      .select("brand_id")
      .eq("id", row.workspace_id)
      .maybeSingle();
    return (quotation as { brand_id?: string | null } | null)?.brand_id ?? null;
  }

  if (row.workspace_type === "shortlist") {
    const { data: shortlist } = await supabase
      .from("discovery_shortlists")
      .select("brand_id")
      .eq("id", row.workspace_id)
      .maybeSingle();
    return (shortlist as { brand_id?: string | null } | null)?.brand_id ?? null;
  }

  return null;
}

/** Case-insensitive exact match, then unique fuzzy contains match. */
export async function resolveBrandIdByName(
  supabase: SupabaseClient<Database>,
  brandName: string | null | undefined
): Promise<string | null> {
  const name = brandName?.trim();
  if (!name) return null;

  const { data: exactRows } = await supabase
    .from("brands")
    .select("id, name")
    .ilike("name", name)
    .limit(8);

  const exact =
    exactRows?.find((row) => row.name.trim().toLowerCase() === name.toLowerCase()) ??
    (exactRows?.length === 1 ? exactRows[0] : null);
  if (exact?.id) return exact.id;

  // Normalize common telecom stylings (e& / E&)
  const compact = name.replace(/\s+/g, "").toLowerCase();
  if (compact === "e&" || compact === "eand") {
    const { data: eand } = await supabase
      .from("brands")
      .select("id, name")
      .or("name.ilike.E&,name.ilike.e&")
      .limit(3);
    if (eand?.length === 1) return eand[0].id;
  }

  const { data: fuzzy } = await supabase
    .from("brands")
    .select("id, name")
    .ilike("name", `%${name}%`)
    .limit(8);

  if (fuzzy?.length === 1) return fuzzy[0].id;

  const uniqueExactish = fuzzy?.filter((row) =>
    row.name.toLowerCase().includes(name.toLowerCase())
  );
  if (uniqueExactish?.length === 1) return uniqueExactish[0].id;

  return null;
}
