import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
  serializeCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import type { AiConversation } from "../types";

/**
 * Restores the latest CampaignObject from DB (fallback: contextSnapshot) and
 * merges it into the conversation context for backward-compatible clients.
 */
export async function hydrateConversationCampaignObject(
  supabase: SupabaseClient<Database>,
  conversation: AiConversation
): Promise<AiConversation> {
  const contextSnapshot = (conversation.contextSnapshot ?? {}) as Record<string, unknown>;
  const restored = await loadCampaignObjectForConversation(
    supabase,
    conversation.id,
    contextSnapshot
  );

  if (!restored) return conversation;

  return {
    ...conversation,
    contextSnapshot: attachCampaignObjectToSnapshot(contextSnapshot, restored) as AiConversation["contextSnapshot"],
    campaignObject: serializeCampaignObject(restored),
  };
}
