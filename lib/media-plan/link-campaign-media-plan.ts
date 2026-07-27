import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Bidirectional link: campaign_headers.campaign_object_id ↔
 * campaign_objects.campaign_header_id.
 * Required so Campaign Media Plan workspace can load Studio Media Plans.
 */
export async function linkCampaignObjectToHeader(
  supabase: SupabaseClient<Database>,
  input: { campaignHeaderId: string; campaignObjectId: string }
): Promise<void> {
  const headerId = input.campaignHeaderId.trim();
  const objectId = input.campaignObjectId.trim();
  if (!headerId || !objectId) return;

  const { error: objectError } = await supabase
    .from("campaign_objects")
    .update({ campaign_header_id: headerId })
    .eq("id", objectId);

  if (objectError) {
    throw new Error(objectError.message);
  }

  const { error: headerError } = await supabase
    .from("campaign_headers")
    .update({ campaign_object_id: objectId })
    .eq("id", headerId);

  if (headerError) {
    throw new Error(headerError.message);
  }
}
