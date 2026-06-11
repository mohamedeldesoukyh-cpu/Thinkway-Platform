import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

export async function ensureCampaignShortlist(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  ownerId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("discovery_shortlists")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: campaign } = await supabase
    .from("campaign_headers")
    .select("name")
    .eq("id", campaignHeaderId)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("discovery_shortlists")
    .insert({
      name: `${(campaign?.name as string) ?? "Campaign"} shortlist`,
      campaign_header_id: campaignHeaderId,
      owner_id: ownerId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return created.id as string;
}

export async function addCreatorToCampaignShortlist(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    ownerId: string;
    creator: UnifiedCreatorResult;
    notes?: string;
    matchScore?: number;
  }
): Promise<void> {
  const shortlistId = await ensureCampaignShortlist(
    supabase,
    input.campaignHeaderId,
    input.ownerId
  );

  const row = {
    shortlist_id: shortlistId,
    unified_id: input.creator.unified_id,
    notes: input.notes ?? null,
    match_score: input.matchScore ?? null,
    profile_id: input.creator.discovered_profile_id,
    influencer_id: input.creator.influencer_id,
    added_by: input.ownerId,
  };

  let existingQuery = supabase
    .from("discovery_shortlist_items")
    .select("id")
    .eq("shortlist_id", shortlistId);

  if (input.creator.discovered_profile_id) {
    existingQuery = existingQuery.eq("profile_id", input.creator.discovered_profile_id);
  } else if (input.creator.influencer_id) {
    existingQuery = existingQuery.eq("influencer_id", input.creator.influencer_id);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("discovery_shortlist_items")
      .update({
        notes: row.notes,
        match_score: row.match_score,
        unified_id: row.unified_id,
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("discovery_shortlist_items").insert(row);
  if (error) throw new Error(error.message);
}

export async function removeFromCampaignShortlist(
  supabase: SupabaseClient,
  itemId: string
): Promise<void> {
  const { error } = await supabase
    .from("discovery_shortlist_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);
}

export async function getCampaignShortlistCreators(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<
  Array<{
    item_id: string;
    notes: string | null;
    match_score: number | null;
    creator: UnifiedCreatorResult | null;
    unified_id: string | null;
  }>
> {
  const { data: shortlists } = await supabase
    .from("discovery_shortlists")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId);

  const shortlistIds = (shortlists ?? []).map((s) => s.id);
  if (shortlistIds.length === 0) return [];

  const { data: items, error } = await supabase
    .from("discovery_shortlist_items")
    .select("id, profile_id, influencer_id, unified_id, notes, match_score, sort_order")
    .in("shortlist_id", shortlistIds)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const browse = await browseUnifiedCreators(supabase, { pageSize: 200 });
  const byUnifiedId = new Map(browse.creators.map((c) => [c.unified_id, c]));
  const byDiscoveryId = new Map(
    browse.creators
      .filter((c) => c.discovered_profile_id)
      .map((c) => [c.discovered_profile_id!, c])
  );
  const byInfluencerId = new Map(
    browse.creators
      .filter((c) => c.influencer_id)
      .map((c) => [c.influencer_id!, c])
  );

  return (items ?? []).map((item) => {
    const creator =
      (item.unified_id ? byUnifiedId.get(item.unified_id as string) : null) ??
      (item.profile_id ? byDiscoveryId.get(item.profile_id as string) : null) ??
      (item.influencer_id ? byInfluencerId.get(item.influencer_id as string) : null) ??
      null;

    return {
      item_id: item.id as string,
      notes: item.notes as string | null,
      match_score: item.match_score as number | null,
      creator,
      unified_id: (item.unified_id as string) ?? creator?.unified_id ?? null,
    };
  });
}

export function shortlistToCsv(
  rows: Array<{ creator: UnifiedCreatorResult | null; notes: string | null }>
): string {
  const header = [
    "display_name",
    "username",
    "platform",
    "source",
    "followers",
    "engagement_rate",
    "thinkway_score",
    "authenticity",
    "country",
    "niche",
    "notes",
  ].join(",");

  const lines = rows.map((row) => {
    const c = row.creator;
    if (!c) return "";
    const p = c.platforms[0];
    return [
      c.display_name,
      p?.handle ?? "",
      p?.platform ?? "",
      c.source_type,
      c.metrics.followers.value ?? "",
      c.metrics.engagement_rate.value ?? "",
      c.thinkway_score,
      c.authenticity_score ?? "",
      c.estimated_country ?? "",
      c.ai_niche ?? c.ai_category ?? "",
      row.notes ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });

  return [header, ...lines.filter(Boolean)].join("\n");
}
