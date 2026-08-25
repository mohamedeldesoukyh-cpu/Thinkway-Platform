import type { SupabaseClient } from "@supabase/supabase-js";

import { pickIdentityLogo, type IdentityLogo } from "@/lib/entity-logos/identity-logo";
import type { Database } from "@/types/database";

export type { IdentityLogo };

export async function loadIdentityLogoForClientId(
  supabase: SupabaseClient<Database | never>,
  clientId: string | null | undefined
): Promise<IdentityLogo | null> {
  const id = clientId?.trim();
  if (!id) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("name, logo_url, group_id")
    .eq("id", id)
    .maybeSingle();
  const clientRow = client as { name?: string | null; logo_url?: string | null; group_id?: string | null } | null;
  if (!clientRow) return null;

  let groupLogoUrl: string | null = null;
  let groupName: string | null = null;
  if (clientRow.group_id) {
    const { data: group } = await supabase
      .from("groups")
      .select("name, logo_url")
      .eq("id", clientRow.group_id)
      .maybeSingle();
    const groupRow = group as { name?: string | null; logo_url?: string | null } | null;
    groupLogoUrl = groupRow?.logo_url ?? null;
    groupName = groupRow?.name ?? null;
  }

  return pickIdentityLogo({
    groupLogoUrl,
    clientLogoUrl: clientRow.logo_url,
    groupName,
    clientName: clientRow.name,
  });
}

export async function loadIdentityLogoForReview(
  supabase: SupabaseClient<Database | never>,
  input: {
    quotationId?: string | null;
    shortlistId?: string | null;
    campaignHeaderId?: string | null;
  }
): Promise<IdentityLogo | null> {
  let clientId: string | null = null;
  let brandId: string | null = null;
  let headerId = input.campaignHeaderId?.trim() || null;

  if (input.quotationId?.trim()) {
    const { data } = await supabase
      .from("quotations")
      .select("client_id, brand_id, campaign_header_id")
      .eq("id", input.quotationId)
      .maybeSingle();
    const row = data as { client_id?: string | null; brand_id?: string | null; campaign_header_id?: string | null } | null;
    clientId = row?.client_id ?? null;
    brandId = row?.brand_id ?? null;
    headerId = headerId || row?.campaign_header_id || null;
  }

  if ((!clientId || !brandId) && input.shortlistId?.trim()) {
    const { data } = await supabase
      .from("discovery_shortlists")
      .select("client_id, brand_id, campaign_header_id")
      .eq("id", input.shortlistId)
      .maybeSingle();
    const row = data as { client_id?: string | null; brand_id?: string | null; campaign_header_id?: string | null } | null;
    clientId = clientId || row?.client_id || null;
    brandId = brandId || row?.brand_id || null;
    headerId = headerId || row?.campaign_header_id || null;
  }

  if (!clientId && headerId) {
    const { data } = await supabase
      .from("campaign_headers")
      .select("client_id, brand_id")
      .eq("id", headerId)
      .maybeSingle();
    const row = data as { client_id?: string | null; brand_id?: string | null } | null;
    clientId = clientId || row?.client_id || null;
    brandId = brandId || row?.brand_id || null;
  }

  if (!clientId && brandId) {
    const { data } = await supabase
      .from("brands")
      .select("client_id")
      .eq("id", brandId)
      .maybeSingle();
    clientId = (data as { client_id?: string | null } | null)?.client_id ?? null;
  }

  if (!clientId) return null;

  return loadIdentityLogoForClientId(supabase, clientId);
}

export function parseIdentityLogo(raw: unknown): IdentityLogo | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  const source = record.source === "group" || record.source === "client" ? record.source : null;
  if (!url || !source) return undefined;
  const alt = typeof record.alt === "string" && record.alt.trim() ? record.alt.trim() : source === "group" ? "Group" : "Client";
  return { url, source, alt };
}
