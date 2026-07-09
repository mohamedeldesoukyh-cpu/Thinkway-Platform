import type { SupabaseClient } from "@supabase/supabase-js";

import { REL } from "@/lib/supabase/relation-hints";

import type {
  CampaignIntelligenceLibraryFilters,
  CampaignIntelligenceLibraryItem,
  CampaignIntelligenceObjectRow,
} from "./types";

const OBJECT_SELECT =
  "id, created_by, updated_by, conversation_id, brand_id, campaign_header_id, status, profile, source_document_id, title, created_at, updated_at";

const LIBRARY_SELECT = `
  id,
  title,
  status,
  brand_id,
  campaign_header_id,
  created_by,
  updated_at,
  profile,
  source_document_id,
  brand:brands (
    id,
    name,
    client_id
  ),
  campaign:${REL.campaignIntelligenceProfiles.campaignHeader} (
    id,
    name,
    document_number
  )
`;

type LibraryRow = {
  id: string;
  title: string | null;
  status: string;
  brand_id: string | null;
  campaign_header_id: string | null;
  created_by: string;
  updated_at: string;
  profile: { campaignName?: string; brandName?: string };
  source_document_id: string | null;
  brand: {
    id: string;
    name: string;
    client_id: string;
  } | null;
  campaign: { id: string; name: string; document_number: string } | null;
};

export async function listCampaignIntelligenceLibrary(
  supabase: SupabaseClient,
  filters: CampaignIntelligenceLibraryFilters = {},
  limit = 50
): Promise<CampaignIntelligenceLibraryItem[]> {
  let query = supabase
    .from("campaign_intelligence_profiles")
    .select(LIBRARY_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (filters.brandId) {
    query = query.eq("brand_id", filters.brandId);
  }
  if (filters.campaignHeaderId) {
    query = query.eq("campaign_header_id", filters.campaignHeaderId);
  }
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let rows = (data ?? []) as unknown as LibraryRow[];

  const clientIds = [
    ...new Set(rows.map((row) => row.brand?.client_id).filter(Boolean) as string[]),
  ];
  const clientNameById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const client of clients ?? []) {
      clientNameById.set(client.id as string, client.name as string);
    }
  }

  const mapRow = (row: LibraryRow): CampaignIntelligenceLibraryItem => {
    const profile = row.profile ?? {};
    const clientId = row.brand?.client_id ?? null;
    return {
      id: row.id,
      title:
        row.title ??
        profile.campaignName ??
        profile.brandName ??
        "Campaign intelligence",
      status: row.status as CampaignIntelligenceLibraryItem["status"],
      brandId: row.brand_id ?? row.brand?.id ?? null,
      brandName: row.brand?.name ?? profile.brandName ?? null,
      clientId,
      clientName: clientId ? clientNameById.get(clientId) ?? null : null,
      campaignHeaderId: row.campaign_header_id ?? row.campaign?.id ?? null,
      campaignName: row.campaign?.name ?? null,
      campaignDocumentNumber: row.campaign?.document_number ?? null,
      fileName: null,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  };

  if (filters.clientId) {
    rows = rows.filter((row) => row.brand?.client_id === filters.clientId);
  }

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter((row) => {
      const item = mapRow(row);
      const haystack = [
        item.title,
        item.brandName,
        item.clientName,
        item.campaignName,
        item.campaignDocumentNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  return rows.map((row) => mapRow(row));
}

export async function listCampaignIntelligenceForBrand(
  supabase: SupabaseClient,
  brandId: string,
  limit = 20
): Promise<CampaignIntelligenceLibraryItem[]> {
  return listCampaignIntelligenceLibrary(supabase, { brandId, status: "all" }, limit);
}

export async function getCampaignIntelligenceObjectById(
  supabase: SupabaseClient,
  profileId: string
): Promise<CampaignIntelligenceObjectRow | null> {
  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select(OBJECT_SELECT)
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as CampaignIntelligenceObjectRow;
}

export async function linkCampaignIntelligenceToCampaign(
  supabase: SupabaseClient,
  input: {
    profileId: string;
    campaignHeaderId: string;
    userId: string;
  }
): Promise<void> {
  const { error: profileError } = await supabase
    .from("campaign_intelligence_profiles")
    .update({
      campaign_header_id: input.campaignHeaderId,
      updated_by: input.userId,
    })
    .eq("id", input.profileId);

  if (profileError) throw new Error(profileError.message);

  const { error: headerError } = await supabase
    .from("campaign_headers")
    .update({ campaign_intelligence_profile_id: input.profileId })
    .eq("id", input.campaignHeaderId);

  if (headerError) throw new Error(headerError.message);
}

export async function getCampaignIntelligenceForHeader(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<CampaignIntelligenceObjectRow | null> {
  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("campaign_intelligence_profile_id")
    .eq("id", campaignHeaderId)
    .maybeSingle();

  if (headerError) throw new Error(headerError.message);
  const profileId = (header as { campaign_intelligence_profile_id?: string | null } | null)
    ?.campaign_intelligence_profile_id;
  if (!profileId) return null;

  return getCampaignIntelligenceObjectById(supabase, profileId);
}
