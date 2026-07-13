import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/lib/validation/uuid";
import type { Database } from "@/types/database";

export type CampaignObjectHeadRow = {
  id: string;
  lifecycle_status: string;
  conversation_id: string | null;
  campaign_header_id: string | null;
};

type ResolveResult =
  | { head: CampaignObjectHeadRow; error?: undefined }
  | { head: null; error?: undefined }
  | { head: null; error: string };

/**
 * Resolve a persisted campaign_objects head by UUID id or conversation id.
 * Never queries campaign_objects.id with non-UUID strings (hydration temps use camp_*).
 */
export async function resolveCampaignObjectHead(
  supabase: SupabaseClient<Database>,
  input: { campaignObjectId: string; conversationId?: string }
): Promise<ResolveResult> {
  const select =
    "id, lifecycle_status, conversation_id, campaign_header_id" as const;

  if (isUuid(input.campaignObjectId)) {
    const { data, error } = await supabase
      .from("campaign_objects")
      .select(select)
      .eq("id", input.campaignObjectId)
      .maybeSingle();

    if (error) return { head: null, error: error.message };
    return { head: (data as CampaignObjectHeadRow | null) ?? null };
  }

  if (input.conversationId && isUuid(input.conversationId)) {
    const { data, error } = await supabase
      .from("campaign_objects")
      .select(select)
      .eq("conversation_id", input.conversationId)
      .maybeSingle();

    if (error) return { head: null, error: error.message };
    return { head: (data as CampaignObjectHeadRow | null) ?? null };
  }

  return { head: null };
}
