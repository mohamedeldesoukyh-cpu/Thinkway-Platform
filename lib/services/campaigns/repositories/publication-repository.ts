import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchCampaignPublicationCount(
  supabase: SupabaseClient,
  campaignId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("campaign_publications")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignId);

  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function countCampaignPublications(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<number> {
  return fetchCampaignPublicationCount(supabase, campaignHeaderId);
}
