import { isUuid } from "@/lib/validation/uuid";
import { requireRequestUser } from "@/lib/supabase/server";
import {
  getCampaignFormOptions as loadCampaignFormOptions,
  getCampaignsKpis as loadCampaignsKpis,
  getCampaignsList as loadCampaignsList,
} from "@/lib/services/campaigns/campaign-service";
import {
  browseInfluencersForCampaign as browseInfluencersViaService,
  getInfluencerForAssignment as getInfluencerForAssignmentViaService,
  searchInfluencersForCampaign as searchInfluencersViaService,
} from "@/lib/services/campaigns/campaign-assignment-service";
import { getCampaignWorkspace as loadCampaignWorkspace } from "@/lib/services/campaigns/campaign-workspace-service";

import type {
  InfluencerAssignmentProfile,
  InfluencerSearchResult,
} from "./types";

export type CampaignsListResult = import("@/lib/services/campaigns/campaign-service").CampaignsListResult;
export type CampaignFormOptions = import("@/lib/services/campaigns/campaign-service").CampaignFormOptions;
export type CampaignsKpis = import("@/lib/services/campaigns/campaign-service").CampaignsKpis;
export type { CampaignWorkspace } from "./types";


export async function getCampaignsList(params: {
  page?: number;
  search?: string;
}): Promise<CampaignsListResult> {
  const { supabase } = await requireRequestUser();
  return loadCampaignsList(supabase, params);
}

export async function getCampaignsKpis(): Promise<CampaignsKpis> {
  const { supabase } = await requireRequestUser();
  return loadCampaignsKpis(supabase);
}

export async function getCampaignFormOptions(): Promise<CampaignFormOptions> {
  const { supabase } = await requireRequestUser();
  return loadCampaignFormOptions(supabase);
}

export async function getCampaignWorkspace(campaignId: string) {
  if (!isUuid(campaignId)) {
    return null;
  }

  const { supabase, userId } = await requireRequestUser();
  return loadCampaignWorkspace(supabase, userId, campaignId);
}

export async function searchInfluencersForCampaign(params: {
  search?: string;
  platform?: string;
  limit?: number;
}): Promise<InfluencerSearchResult[]> {
  const { supabase } = await requireRequestUser();
  return searchInfluencersViaService(supabase, params);
}

export async function getInfluencerForAssignment(
  influencerId: string
): Promise<InfluencerAssignmentProfile | null> {
  const { supabase } = await requireRequestUser();
  return getInfluencerForAssignmentViaService(supabase, influencerId);
}

export async function browseInfluencersForCampaign(
  params: import("./types").CreatorBrowseFilters
): Promise<import("./types").CreatorBrowseResult> {
  const { supabase } = await requireRequestUser();
  return browseInfluencersViaService(supabase, params);
}

export { getBrandHierarchySnapshot } from "@/lib/master-data/queries";
