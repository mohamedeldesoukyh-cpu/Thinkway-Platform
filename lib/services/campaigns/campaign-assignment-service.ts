import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreatorBrowseFilters,
  CreatorBrowseResult,
  InfluencerAssignmentProfile,
  InfluencerSearchResult,
} from "@/lib/domains/creator/types";

import { emptyToNull } from "./campaign-commercial";
import {
  browseInfluencers,
  getInfluencerAssignmentProfile,
  insertDeliverable,
  searchInfluencers,
} from "./repositories/assignment-repository";

export async function searchInfluencersForCampaign(
  supabase: SupabaseClient,
  params: { search?: string; platform?: string; limit?: number }
): Promise<InfluencerSearchResult[]> {
  return searchInfluencers(supabase, params);
}

export async function getInfluencerForAssignment(
  supabase: SupabaseClient,
  influencerId: string
): Promise<InfluencerAssignmentProfile | null> {
  return getInfluencerAssignmentProfile(supabase, influencerId);
}

export async function browseInfluencersForCampaign(
  supabase: SupabaseClient,
  params: CreatorBrowseFilters
): Promise<CreatorBrowseResult> {
  return browseInfluencers(supabase, params);
}

export type CreateDeliverableInput = {
  campaign_id: string;
  influencer_id: string;
  campaign_influencer_id?: string;
  deliverable_type: string;
  title: string;
  platform?: string;
  due_date: string | null;
};

export async function createDeliverable(
  supabase: SupabaseClient,
  userId: string,
  input: CreateDeliverableInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const docNumber = `DEL-${Date.now()}`;

  const { error } = await insertDeliverable(supabase, {
    document_number: docNumber,
    campaign_id: input.campaign_id,
    influencer_id: input.influencer_id,
    campaign_influencer_id: emptyToNull(input.campaign_influencer_id),
    deliverable_type: input.deliverable_type,
    title: input.title,
    platform: emptyToNull(input.platform),
    due_date: input.due_date,
    created_by: userId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}
