import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
  serializeCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import { enrichCampaignObjectQuotationContext } from "@/features/campaign-outputs/hydration/enrich-quotation-commercials-context";
import { isStudioMessage } from "@/features/ai-workspace/components/campaign-studio-panel-utils";
import type { AiConversation } from "../types";

function patchLatestStudioMessageCampaignObject(
  messages: AiConversation["messages"],
  campaignObject: NonNullable<Awaited<ReturnType<typeof loadCampaignObjectForConversation>>>
): AiConversation["messages"] {
  if (!messages?.length) return messages;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (!isStudioMessage(message)) continue;

    const serialized = serializeCampaignObject(campaignObject);
    return messages.map((entry, index) =>
      index === i
        ? {
            ...entry,
            metadata: {
              ...entry.metadata,
              campaignObject: serialized,
            },
          }
        : entry
    );
  }

  return messages;
}

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

  const enriched = await enrichCampaignObjectQuotationContext(supabase, restored, {
    workspaceType: conversation.workspaceType,
    workspaceId: conversation.workspaceId,
  });

  const nextSnapshot = attachCampaignObjectToSnapshot(contextSnapshot, enriched);
  const messages = patchLatestStudioMessageCampaignObject(
    conversation.messages,
    enriched
  );

  return {
    ...conversation,
    contextSnapshot: nextSnapshot as AiConversation["contextSnapshot"],
    campaignObject: serializeCampaignObject(enriched),
    messages,
  };
}
