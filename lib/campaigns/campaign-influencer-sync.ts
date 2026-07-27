import type { SupabaseClient } from "@supabase/supabase-js";

import { maybeActivateCommercialCreatorForAssignment } from "@/lib/campaigns/campaign-influencer-commercial";
import type { Database } from "@/types/database";

type TypedSupabase = SupabaseClient<Database>;

export type CampaignInfluencerLinePayload = {
  status: string;
  currency: string;
  deliverable_count: number;
  cost_before_vat: number;
  cost_vat_percent: number;
  cost_vat_amount: number;
  cost_after_vat: number;
  invited_at?: string | null;
  confirmed_at?: string | null;
  created_by?: string | null;
};

export type SyncCampaignInfluencerInput = {
  campaignId: string;
  lineId: string;
  influencerId: string;
  payload: CampaignInfluencerLinePayload;
};

/**
 * Idempotent campaign_influencers sync for a campaign line assignment.
 * Uses upsert on (campaign_header_id, campaign_line_id, influencer_id).
 * Attaches legacy orphan rows (header + influencer, no line) before insert.
 */
async function finishSyncSuccess(
  supabase: TypedSupabase,
  input: SyncCampaignInfluencerInput,
  campaignInfluencerId: string
): Promise<{ id: string }> {
  await maybeActivateCommercialCreatorForAssignment(supabase, {
    influencerId: input.influencerId,
    campaignInfluencerId,
    actorId: input.payload.created_by ?? null,
    metadata: {
      path: "syncCampaignInfluencerForLine",
      campaignId: input.campaignId,
      lineId: input.lineId,
    },
  });
  return { id: campaignInfluencerId };
}

/**
 * Idempotent campaign_influencers sync for a campaign line assignment.
 * Uses upsert on (campaign_header_id, campaign_line_id, influencer_id).
 * Attaches legacy orphan rows (header + influencer, no line) before insert.
 *
 * Phase 2B.1: sole line-assignment hub for Commercial Creator activation
 * (`campaign_assignment`) via maybeActivateCommercialCreatorForAssignment.
 */
export async function syncCampaignInfluencerForLine(
  supabase: SupabaseClient,
  input: SyncCampaignInfluencerInput
): Promise<{ id: string; error?: string }> {
  const typed = supabase as TypedSupabase;
  const row = {
    campaign_id: input.campaignId,
    campaign_header_id: input.campaignId,
    campaign_line_id: input.lineId,
    influencer_id: input.influencerId,
    ...input.payload,
  };

  const { data: byLine } = await typed
    .from("campaign_influencers")
    .select("id")
    .eq("campaign_line_id", input.lineId)
    .maybeSingle();

  if (byLine) {
    const { data: updated, error: updateError } = await typed
      .from("campaign_influencers")
      .update({
        influencer_id: input.influencerId,
        campaign_header_id: input.campaignId,
        ...input.payload,
      })
      .eq("id", byLine.id)
      .select("id")
      .single();

    if (!updateError && updated) {
      return finishSyncSuccess(typed, input, updated.id);
    }
    return {
      id: "",
      error: updateError?.message ?? "Failed to update vendor assignment.",
    };
  }

  const { data: orphan } = await typed
    .from("campaign_influencers")
    .select("id")
    .or(
      `campaign_header_id.eq.${input.campaignId},campaign_id.eq.${input.campaignId}`
    )
    .eq("influencer_id", input.influencerId)
    .is("campaign_line_id", null)
    .maybeSingle();

  if (orphan) {
    const { data: attached, error: attachError } = await typed
      .from("campaign_influencers")
      .update({
        campaign_header_id: input.campaignId,
        campaign_line_id: input.lineId,
        ...input.payload,
      })
      .eq("id", orphan.id)
      .select("id")
      .single();

    if (!attachError && attached) {
      return finishSyncSuccess(typed, input, attached.id);
    }
    return {
      id: "",
      error: attachError?.message ?? "Failed to attach vendor assignment.",
    };
  }

  const { data: upserted, error: upsertError } = await typed
    .from("campaign_influencers")
    .upsert(row, {
      onConflict: "campaign_header_id,campaign_line_id,influencer_id",
    })
    .select("id")
    .single();

  if (!upsertError && upserted) {
    return finishSyncSuccess(typed, input, upserted.id);
  }

  const { data: legacy } = await typed
    .from("campaign_influencers")
    .select("id, campaign_line_id")
    .eq("campaign_id", input.campaignId)
    .eq("influencer_id", input.influencerId)
    .maybeSingle();

  if (
    legacy &&
    (!legacy.campaign_line_id || legacy.campaign_line_id === input.lineId)
  ) {
    const { data: updated, error: updateError } = await typed
      .from("campaign_influencers")
      .update({
        campaign_header_id: input.campaignId,
        campaign_line_id: input.lineId,
        ...input.payload,
      })
      .eq("id", legacy.id)
      .select("id")
      .single();

    if (!updateError && updated) {
      return finishSyncSuccess(typed, input, updated.id);
    }
    return {
      id: "",
      error: updateError?.message ?? upsertError?.message ?? "Failed to update vendor.",
    };
  }

  return {
    id: "",
    error:
      upsertError?.message ??
      "Failed to sync campaign influencer.",
  };
}
