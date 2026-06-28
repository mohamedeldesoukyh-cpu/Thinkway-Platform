"use server";

import { revalidatePath } from "next/cache";

import {
  addCreatorToCampaignShortlist,
  getCampaignShortlistCreators,
  removeFromCampaignShortlist,
  shortlistToCsv,
} from "@/lib/creators/campaign-shortlist";
import { matchCreatorsForCampaign } from "@/lib/creators/campaign-match";
import { findSimilarCreators } from "@/lib/creators/similar-creators";
import { loadCreatorHistoricalMetrics } from "@/lib/creators/historical-metrics";
import { browseUnifiedCreators, getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorBrowseFilters, UnifiedCreatorResult } from "@/lib/creators/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, userId: user.id };
}

export async function browseUnifiedCreatorsAction(filters: UnifiedCreatorBrowseFilters) {
  const { supabase } = await requireUserId();
  return browseUnifiedCreators(supabase, filters);
}

export async function getUnifiedCreatorDetailAction(unifiedId: string) {
  if (!unifiedId?.trim()) return null;
  const { supabase } = await requireUserId();
  return getUnifiedCreatorById(supabase, unifiedId.trim());
}

export async function addCreatorToCampaignShortlistAction(
  campaignHeaderId: string,
  creator: UnifiedCreatorResult,
  notes?: string
) {
  const { supabase, userId } = await requireUserId();
  await addCreatorToCampaignShortlist(supabase, {
    campaignHeaderId,
    ownerId: userId,
    creator,
    notes,
  });
  revalidatePath(`/campaigns/${campaignHeaderId}`);
}

export async function removeCreatorFromShortlistAction(
  campaignHeaderId: string,
  itemId: string
) {
  const { supabase } = await requireUserId();
  await removeFromCampaignShortlist(supabase, itemId);
  revalidatePath(`/campaigns/${campaignHeaderId}`);
}

export async function getCampaignShortlistAction(campaignHeaderId: string) {
  const { supabase } = await requireUserId();
  return getCampaignShortlistCreators(supabase, campaignHeaderId);
}

export async function exportCampaignShortlistCsvAction(campaignHeaderId: string) {
  const { supabase } = await requireUserId();
  const rows = await getCampaignShortlistCreators(supabase, campaignHeaderId);
  return shortlistToCsv(rows);
}

export async function matchCampaignCreatorsAction(input: {
  campaignHeaderId: string;
  brief: string;
  platform?: string;
  country?: string;
  limit?: number;
}) {
  const { supabase, userId } = await requireUserId();
  return matchCreatorsForCampaign(supabase, {
    ...input,
    createdBy: userId,
  });
}

export async function getSimilarCreatorsAction(unifiedId: string) {
  const { supabase } = await requireUserId();
  const creator = await getUnifiedCreatorById(supabase, unifiedId);
  if (!creator) return [];
  return findSimilarCreators(supabase, creator);
}

export async function getCreatorHistoricalMetricsAction(unifiedId: string) {
  const { supabase } = await requireUserId();
  return loadCreatorHistoricalMetrics(supabase, unifiedId);
}
