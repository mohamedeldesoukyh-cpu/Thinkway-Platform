import type { SupabaseClient } from "@supabase/supabase-js";

import { pickIdentityLogo, type IdentityLogo } from "@/lib/entity-logos/identity-logo";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import { normalizeEntityName } from "@/lib/validation/hierarchy";
import type { Database } from "@/types/database";

export type { IdentityLogo };

type IdentityDb = SupabaseClient<Database | never>;

type ClientIdentityRow = {
  id?: string | null;
  name?: string | null;
  logo_url?: string | null;
  group_id?: string | null;
};

export function uniqueIdentityClientIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const value = id?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function identityClientLabelCandidates(labels: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const label of labels) {
    const value = label?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export async function loadIdentityLogoForClientId(
  supabase: IdentityDb,
  clientId: string | null | undefined
): Promise<IdentityLogo | null> {
  const id = clientId?.trim();
  if (!id) return null;

  const { data: client } = await supabase
    .from("clients")
    .select("name, logo_url, group_id")
    .eq("id", id)
    .maybeSingle();
  const clientRow = client as ClientIdentityRow | null;
  if (!clientRow) return null;

  return pickIdentityLogoFromClientRow(supabase, clientRow);
}

export async function loadIdentityLogoForPortalClient(
  userClient: IdentityDb,
  clientId: string | null | undefined
): Promise<IdentityLogo | null> {
  const service = tryCreateServiceRoleClient().client;
  return loadIdentityLogoForClientId((service ?? userClient) as IdentityDb, clientId);
}

async function pickIdentityLogoFromClientRow(
  supabase: IdentityDb,
  clientRow: ClientIdentityRow
): Promise<IdentityLogo | null> {
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

async function loadIdentityLogoByClientLabel(
  supabase: IdentityDb,
  label: string | null | undefined
): Promise<IdentityLogo | null> {
  const trimmed = label?.trim();
  if (!trimmed) return null;

  const normalized = normalizeEntityName(trimmed);
  const base = supabase.from("clients").select("id, name, logo_url, group_id, status");
  const filtered = /^CIT-\d+$/i.test(trimmed)
    ? base.eq("document_number", trimmed.toUpperCase())
    : base.eq("name_normalized", normalized);
  const { data } = await filtered.limit(8);
  const rows = (data ?? []) as Array<ClientIdentityRow & { status?: string | null }>;
  const chosen =
    rows.find((row) => row.logo_url?.trim()) ??
    rows.find((row) => row.status === "active") ??
    rows[0] ??
    null;
  if (!chosen?.id) return null;
  return pickIdentityLogoFromClientRow(supabase, chosen);
}

export async function loadIdentityLogoForReview(
  supabase: IdentityDb,
  input: {
    quotationId?: string | null;
    shortlistId?: string | null;
    campaignHeaderId?: string | null;
    clientLabel?: string | null;
  }
): Promise<IdentityLogo | null> {
  const candidateIds: Array<string | null | undefined> = [];
  const labels: Array<string | null | undefined> = [input.clientLabel];
  let brandId: string | null = null;
  let headerId = input.campaignHeaderId?.trim() || null;

  if (input.quotationId?.trim()) {
    const { data } = await supabase
      .from("quotations")
      .select("client_id, brand_id, campaign_header_id, temporary_client_name")
      .eq("id", input.quotationId)
      .maybeSingle();
    const row = data as {
      client_id?: string | null;
      brand_id?: string | null;
      campaign_header_id?: string | null;
      temporary_client_name?: string | null;
    } | null;
    candidateIds.push(row?.client_id ?? null);
    brandId = row?.brand_id ?? null;
    headerId = headerId || row?.campaign_header_id || null;
    labels.push(row?.temporary_client_name ?? null);
  }

  if (input.shortlistId?.trim()) {
    const { data } = await supabase
      .from("discovery_shortlists")
      .select("client_id, brand_id, campaign_header_id")
      .eq("id", input.shortlistId)
      .maybeSingle();
    const row = data as {
      client_id?: string | null;
      brand_id?: string | null;
      campaign_header_id?: string | null;
    } | null;
    candidateIds.push(row?.client_id ?? null);
    brandId = brandId || row?.brand_id || null;
    headerId = headerId || row?.campaign_header_id || null;
  }

  if (headerId) {
    const { data } = await supabase
      .from("campaign_headers")
      .select("client_id, brand_id")
      .eq("id", headerId)
      .maybeSingle();
    const row = data as { client_id?: string | null; brand_id?: string | null } | null;
    candidateIds.push(row?.client_id ?? null);
    brandId = brandId || row?.brand_id || null;
  }

  if (brandId) {
    const { data } = await supabase
      .from("brands")
      .select("client_id")
      .eq("id", brandId)
      .maybeSingle();
    candidateIds.push((data as { client_id?: string | null } | null)?.client_id ?? null);
  }

  for (const clientId of uniqueIdentityClientIds(candidateIds)) {
    const logo = await loadIdentityLogoForClientId(supabase, clientId);
    if (logo) return logo;
  }

  for (const label of identityClientLabelCandidates(labels)) {
    const logo = await loadIdentityLogoByClientLabel(supabase, label);
    if (logo) return logo;
  }

  return null;
}

export function parseIdentityLogo(raw: unknown): IdentityLogo | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const record = raw as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  const source = record.source === "group" || record.source === "client" ? record.source : null;
  if (!url || !source) return undefined;
  const alt =
    typeof record.alt === "string" && record.alt.trim()
      ? record.alt.trim()
      : source === "group"
        ? "Group"
        : "Client";
  return { url, source, alt };
}
