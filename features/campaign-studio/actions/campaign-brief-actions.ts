"use server";

import {
  loadCampaignObjectFromPersistence,
  saveCampaignObject,
  serializeCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import { getOutputDefinition } from "@/features/campaign-outputs/output-catalog";
import { staleCampaignOutputKinds } from "@/features/campaign-outputs/output-registry";
import { syncLatestStudioMessageCampaignObject } from "@/features/ai-workspace/services/conversation-campaign-hydration";
import { getConversationWithMessages } from "@/features/ai-workspace/services/conversation-service";

import { mergeBriefIntoCampaignObject } from "../services/merge-campaign-brief";
import {
  campaignObjectFromLatestStudioMessage,
  resolveCampaignObjectForBriefEdit,
} from "../services/resolve-campaign-object-for-edit";
import { loadCampaignObjectFromMessage, requireStudioUser } from "./persist-campaign-object-on-message";

export type ApplyCampaignBriefInput = {
  conversationId: string;
  messageId: string;
  briefText: string;
};

export type ApplyCampaignBriefResult = {
  ok: boolean;
  message: string;
  campaignObject?: Record<string, unknown>;
};

export async function applyCampaignBriefAction(
  input: ApplyCampaignBriefInput
): Promise<ApplyCampaignBriefResult> {
  const trimmed = input.briefText.trim();
  if (trimmed.length < 40) {
    return {
      ok: false,
      message: "Add a fuller brief — at least a short paragraph with objective, audience, and timing.",
    };
  }

  try {
    const { userId, supabase } = await requireStudioUser();
    const conversation = await getConversationWithMessages(
      supabase,
      input.conversationId,
      userId
    );
    if (!conversation) {
      return { ok: false, message: "Could not find the campaign workspace to update." };
    }

    const contextSnapshot = (conversation.contextSnapshot ?? {}) as Record<string, unknown>;
    const fromPersistence = await loadCampaignObjectFromPersistence(
      supabase,
      input.conversationId,
      contextSnapshot
    );
    const fromLatestMessage = campaignObjectFromLatestStudioMessage(conversation.messages);
    const fromBoundMessage = await loadCampaignObjectFromMessage(
      input.conversationId,
      input.messageId,
      userId
    );
    const canonical = resolveCampaignObjectForBriefEdit({
      fromPersistence,
      fromLatestStudioMessage: fromLatestMessage,
      fromBoundMessage,
    });

    if (!canonical) {
      return { ok: false, message: "Could not find the campaign workspace to update." };
    }

    const result = mergeBriefIntoCampaignObject(canonical, trimmed);
    if (!result.change) {
      return {
        ok: false,
        message: "Brief unchanged — add more detail or edit the existing text.",
      };
    }

    const saved = await saveCampaignObject(input.conversationId, result.campaignObject, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });

    await syncLatestStudioMessageCampaignObject(
      supabase,
      input.conversationId,
      userId,
      saved
    );

    const staleLabels = staleCampaignOutputKinds(saved).map(
      (kind) => getOutputDefinition(kind)?.label ?? kind
    );
    const message =
      staleLabels.length > 0
        ? `Campaign brief saved — ${staleLabels.join(", ")} need updating. Regenerate from Outputs when ready.`
        : "Campaign brief saved — creator slate preserved.";

    return {
      ok: true,
      message,
      campaignObject: serializeCampaignObject(saved) as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to save the campaign brief.",
    };
  }
}
