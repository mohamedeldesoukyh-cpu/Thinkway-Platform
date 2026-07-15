"use server";

import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";

import { mergeBriefIntoCampaignObject } from "../services/merge-campaign-brief";
import { persistCampaignObjectOnMessage, requireStudioUser } from "./persist-campaign-object-on-message";

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
    let mergedObject: Awaited<ReturnType<typeof persistCampaignObjectOnMessage>> = null;

    mergedObject = await persistCampaignObjectOnMessage(
      input.conversationId,
      input.messageId,
      userId,
      (object) => {
        const result = mergeBriefIntoCampaignObject(object, trimmed);
        if (!result.change) return object;
        return result.campaignObject;
      }
    );

    if (!mergedObject) {
      return { ok: false, message: "Could not find the campaign workspace to update." };
    }

    await saveCampaignObject(input.conversationId, mergedObject, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });

    return {
      ok: true,
      message: "Campaign brief saved — dependent outputs marked for regeneration; creator slate preserved.",
      campaignObject: mergedObject as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to save the campaign brief.",
    };
  }
}
