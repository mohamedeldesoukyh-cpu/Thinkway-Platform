import type { SupabaseClient } from "@supabase/supabase-js";

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
export async function syncCampaignInfluencerForLine(
  supabase: SupabaseClient,
  input: SyncCampaignInfluencerInput
): Promise<{ id: string; error?: string }> {
  const row = {
    campaign_id: input.campaignId,
    campaign_header_id: input.campaignId,
    campaign_line_id: input.lineId,
    influencer_id: input.influencerId,
    ...input.payload,
  };

  const { data: byLine } = await supabase
    .from("campaign_influencers")
    .select("id")
    .eq("campaign_line_id", input.lineId)
    .maybeSingle();

  if (byLine) {
    const { data: updated, error: updateError } = await supabase
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
      return { id: updated.id };
    }
    return {
      id: "",
      error: updateError?.message ?? "Failed to update vendor assignment.",
    };
  }

  const { data: orphan } = await supabase
    .from("campaign_influencers")
    .select("id")
    .or(
      `campaign_header_id.eq.${input.campaignId},campaign_id.eq.${input.campaignId}`
    )
    .eq("influencer_id", input.influencerId)
    .is("campaign_line_id", null)
    .maybeSingle();

  if (orphan) {
    const { data: attached, error: attachError } = await supabase
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
      return { id: attached.id };
    }
    return {
      id: "",
      error: attachError?.message ?? "Failed to attach vendor assignment.",
    };
  }

  const { data: upserted, error: upsertError } = await supabase
    .from("campaign_influencers")
    .upsert(row, {
      onConflict: "campaign_header_id,campaign_line_id,influencer_id",
    })
    .select("id")
    .single();

  if (!upsertError && upserted) {
    return { id: upserted.id };
  }

  const { data: legacy } = await supabase
    .from("campaign_influencers")
    .select("id, campaign_line_id")
    .eq("campaign_id", input.campaignId)
    .eq("influencer_id", input.influencerId)
    .maybeSingle();

  if (
    legacy &&
    (!legacy.campaign_line_id || legacy.campaign_line_id === input.lineId)
  ) {
    const { data: updated, error: updateError } = await supabase
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
      return { id: updated.id };
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
