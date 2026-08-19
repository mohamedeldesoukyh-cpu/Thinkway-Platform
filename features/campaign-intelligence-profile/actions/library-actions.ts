"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  listCampaignIntelligenceLibrary,
  type CampaignIntelligenceLibraryFilters,
  type CampaignIntelligenceLibraryItem,
} from "@/lib/domains/intelligence/campaign-intelligence-object";
import { requireRequestUser } from "@/lib/supabase/server";

import type { BrandSelectRow } from "../services/build-brand-link-dialog-options";
import {
  BRAND_SELECT_LIMIT,
  loadAccessibleBrandSelectRows,
} from "../services/accessible-brands";
import {
  getCampaignIntelligenceProfileById,
} from "../services/profile-repository";
import { elevatedUpdateCampaignIntelligenceProfile } from "../services/profile-repository-elevated";
import {
  loadCampaignIntelligenceWorkspaceAction,
  type CampaignIntelligenceWorkspaceState,
} from "./profile-actions";


export type CampaignIntelligenceLibraryFilterOptions = {
  brands: BrandSelectRow[];
  clients: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string; documentNumber: string; brandId: string }>;
};

export async function listBrandsForIntelligenceLinkAction(): Promise<BrandSelectRow[]> {
  const { supabase } = await requireRequestUser();
  return loadAccessibleBrandSelectRows(supabase);
}

export async function listCampaignIntelligenceLibraryAction(
  filters: CampaignIntelligenceLibraryFilters = {}
): Promise<CampaignIntelligenceLibraryItem[]> {
  const { supabase } = await requireRequestUser();
  return listCampaignIntelligenceLibrary(supabase, filters, 100);
}

export async function getCampaignIntelligenceLibraryFilterOptionsAction(): Promise<CampaignIntelligenceLibraryFilterOptions> {
  const { supabase } = await requireRequestUser();

  const [brands, clientsRes, campaignsRes] = await Promise.all([
    loadAccessibleBrandSelectRows(supabase),
    supabase.from("clients").select("id, name").order("name").limit(BRAND_SELECT_LIMIT),
    supabase
      .from("campaign_headers")
      .select("id, name, document_number, brand_id")
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);

  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (campaignsRes.error) throw new Error(campaignsRes.error.message);

  const clients = (clientsRes.data ?? []) as Array<{ id: string; name: string }>;

  const campaigns = (
    (campaignsRes.data ?? []) as Array<{
      id: string;
      name: string;
      document_number: string;
      brand_id: string;
    }>
  ).map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    documentNumber: campaign.document_number,
    brandId: campaign.brand_id,
  }));

  return { brands, clients, campaigns };
}

export async function listExistingIntelligenceForBrandAction(
  brandId: string
): Promise<CampaignIntelligenceLibraryItem[]> {
  const { supabase } = await requireRequestUser();
  const trimmedBrandId = brandId.trim();
  if (!trimmedBrandId) return [];

  const { data, error } = await supabase
    .from("campaign_intelligence_profiles")
    .select("id, title, status, brand_id, campaign_header_id, profile, updated_at, created_by")
    .eq("brand_id", trimmedBrandId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(15);

  if (error) throw new Error(error.message);

  type Row = {
    id: string;
    title: string | null;
    status: string;
    brand_id: string | null;
    campaign_header_id: string | null;
    profile: { campaignName?: string; brandName?: string };
    updated_at: string;
    created_by: string;
  };

  return ((data ?? []) as Row[]).map((row) => {
    const profile = row.profile ?? {};
    return {
      id: row.id,
      title:
        row.title ??
        profile.campaignName ??
        profile.brandName ??
        "Campaign intelligence",
      status: row.status as CampaignIntelligenceLibraryItem["status"],
      brandId: row.brand_id,
      brandName: profile.brandName ?? null,
      clientId: null,
      clientName: null,
      campaignHeaderId: row.campaign_header_id,
      campaignName: null,
      campaignDocumentNumber: null,
      fileName: null,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  });
}

export async function openCampaignIntelligenceFromLibraryAction(
  profileId: string
): Promise<CampaignIntelligenceWorkspaceState | null> {
  return loadCampaignIntelligenceWorkspaceAction(profileId);
}

export async function archiveCampaignIntelligenceAction(
  profileId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const { supabase, userId } = await requireRequestUser();
    const row = await getCampaignIntelligenceProfileById(supabase, profileId);
    if (!row) return { ok: false, message: "Intelligence record not found." };

    await elevatedUpdateCampaignIntelligenceProfile(supabase, profileId, {
      userId,
      profile: row.profile,
      status: "archived",
    });

    revalidatePath("/discovery/intelligence/library");
    revalidatePath("/discovery/search");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not archive record",
    };
  }
}
