import type { SupabaseClient } from "@supabase/supabase-js";

const PROXY_CLIENT_LABEL = "Client (entered by Thinkway)";
const PROXY_CREATOR_LABEL = "Creator (entered by Thinkway)";

export type CampaignScriptConversationDisplayNames = {
  clientName: string;
  creatorName: string;
};

/**
 * The actor selector deliberately retains generic labels. This translates only
 * the saved proxy labels into the people represented by the selected unit.
 */
export async function loadCampaignScriptConversationDisplayNames(
  supabase: SupabaseClient,
  input: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    clientFallback?: string | null;
  }
): Promise<CampaignScriptConversationDisplayNames> {
  const [headerResult, deliverableResult] = await Promise.all([
    supabase
      .from("campaign_headers")
      .select("client:clients(name)")
      .eq("id", input.campaignHeaderId)
      .maybeSingle(),
    supabase
      .from("assignment_deliverables")
      .select("campaign_line_id")
      .eq("id", input.assignmentDeliverableId)
      .eq("campaign_header_id", input.campaignHeaderId)
      .maybeSingle(),
  ]);

  const header = headerResult.data as unknown as {
    client: { name: string | null } | null;
  } | null;
  const clientName =
    header?.client?.name?.trim() || input.clientFallback?.trim() || "Client";
  const lineId = deliverableResult.data?.campaign_line_id ?? null;
  if (!lineId) return { clientName, creatorName: "Creator" };

  const creatorResult = await supabase
    .from("campaign_influencers")
    .select("influencer:influencers(display_name)")
    .eq("campaign_header_id", input.campaignHeaderId)
    .eq("campaign_line_id", lineId)
    .maybeSingle();
  const creator = creatorResult.data as unknown as {
    influencer: { display_name: string | null } | null;
  } | null;
  return {
    clientName,
    creatorName: creator?.influencer?.display_name?.trim() || "Creator",
  };
}
export function scriptConversationAuthorDisplayName(
  authorDisplayName: string | null,
  names: CampaignScriptConversationDisplayNames
): string | null {
  if (authorDisplayName === PROXY_CLIENT_LABEL) return names.clientName;
  if (authorDisplayName === PROXY_CREATOR_LABEL) return names.creatorName;
  return authorDisplayName;
}
