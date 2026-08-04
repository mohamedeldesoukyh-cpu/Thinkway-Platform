import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  getConversationWithMessages,
  updateConversationContextSnapshot,
  updateMessageMetadata,
} from "@/features/ai-workspace/services/conversation-service";
import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectFromPersistence,
  serializeCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import { enrichCampaignObjectQuotationContext } from "@/features/campaign-outputs/hydration/enrich-quotation-commercials-context";
import { isStudioMessage } from "@/features/ai-workspace/components/campaign-studio-panel-utils";
import type { AiConversation } from "../types";

function patchLatestStudioMessageCampaignObject(
  messages: AiConversation["messages"],
  campaignObject: CampaignObject
): { messages: AiConversation["messages"]; messageId: string | null } {
  if (!messages?.length) return { messages, messageId: null };

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]!;
    if (!isStudioMessage(message)) continue;

    // STAB-036: never regress a finished Studio package with a weaker hydrate.
    const existingScore = campaignObjectReadinessScore(message.metadata?.campaignObject);
    const incomingScore = campaignObjectReadinessScore(campaignObject);
    if (existingScore > incomingScore) {
      return { messages, messageId: message.id };
    }

    const serialized = serializeCampaignObject(campaignObject);
    const nextMessages = messages.map((entry, index) =>
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
    return { messages: nextMessages, messageId: message.id };
  }

  return { messages, messageId: null };
}

/** Persist the canonical campaign object onto the latest studio message metadata. */
export async function syncLatestStudioMessageCampaignObject(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  userId: string,
  campaignObject: CampaignObject
): Promise<void> {
  const conversation = await getConversationWithMessages(supabase, conversationId, userId);
  if (!conversation?.messages?.length) return;

  const { messages, messageId } = patchLatestStudioMessageCampaignObject(
    conversation.messages,
    campaignObject
  );
  if (!messages?.length || !messageId) return;

  const message = messages.find((entry) => entry.id === messageId);
  if (!message?.metadata) return;

  await updateMessageMetadata(supabase, messageId, message.metadata);

  try {
    await updateConversationContextSnapshot(
      supabase,
      conversationId,
      userId,
      attachCampaignObjectToSnapshot(
        (conversation.contextSnapshot ?? {}) as Record<string, unknown>,
        campaignObject
      )
    );
  } catch {
    /* studio message carries the object */
  }
}

function campaignObjectReadinessScore(campaignObject: unknown): number {
  if (!campaignObject || typeof campaignObject !== "object") return -1;
  const meta = (campaignObject as { meta?: { status?: string; progressPercent?: number } })
    .meta;
  const status = String(meta?.status ?? "").toLowerCase();
  const progress = Number(meta?.progressPercent ?? 0);
  if (status === "complete" || status === "completed" || status === "approved") {
    return 1000 + progress;
  }
  if (status === "building" || status === "working" || status === "in_progress") {
    return progress;
  }
  return progress;
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
  // STAB-036: never hydrate Studio from the process memory cache — a mid-build
  // object cached during generation can overwrite a finished package on reload.
  const restored = await loadCampaignObjectFromPersistence(
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
  const { messages } = patchLatestStudioMessageCampaignObject(conversation.messages, enriched);

  return {
    ...conversation,
    contextSnapshot: nextSnapshot as AiConversation["contextSnapshot"],
    campaignObject: serializeCampaignObject(enriched),
    messages,
  };
}
