"use server";

import {
  deserializeCampaignObject,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { createShortlistV2, addCreatorsToShortlistsV2 } from "@/features/discovery/shortlists/actions";
import { getConversationWithMessages } from "@/features/ai-workspace/services/conversation-service";

import {
  persistCampaignObjectOnMessage,
  requireStudioUser,
} from "./persist-campaign-object-on-message";

export type VendorRecommendationDecision = "approved" | "rejected" | "shortlisted";

export type VendorRecommendationActionResult = {
  ok: boolean;
  message: string;
  vendorDecisions?: Record<string, VendorRecommendationDecision>;
  linkedShortlistId?: string;
  shortlistUrl?: string;
};

function patchCampaignObjectVendorDecisions(
  campaignObject: CampaignObject,
  creatorId: string,
  decision: VendorRecommendationDecision,
  linkedShortlistId?: string
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const vendorDecisions = { ...(creatorsData.vendorDecisions ?? {}), [creatorId]: decision };
  const nextData: CreatorsSectionData = {
    ...creatorsData,
    vendorDecisions,
    ...(linkedShortlistId ? { linkedShortlistId } : {}),
    phase: decision === "shortlisted" ? "shortlist" : creatorsData.phase,
  };

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        ...campaignObject.sections.creators,
        data: nextData,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function decideVendorRecommendationAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  decision: "approved" | "rejected";
}): Promise<VendorRecommendationActionResult> {
  try {
    const { userId } = await requireStudioUser();
    const next = await persistCampaignObjectOnMessage(
      input.conversationId,
      input.messageId,
      userId,
      (object) => patchCampaignObjectVendorDecisions(object, input.creatorId, input.decision)
    );

    if (!next) {
      return { ok: false, message: "Campaign studio message not found." };
    }

    const decisions = (next.sections.creators.data as CreatorsSectionData | undefined)
      ?.vendorDecisions;

    return {
      ok: true,
      message:
        input.decision === "approved"
          ? "Creator approved for this campaign plan."
          : "Creator removed from recommendations.",
      vendorDecisions: decisions,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not save decision.",
    };
  }
}

export async function shortlistVendorRecommendationAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  creatorUnifiedId: string;
  campaignName?: string;
}): Promise<VendorRecommendationActionResult> {
  try {
    const { supabase, userId } = await requireStudioUser();

    const conversation = await getConversationWithMessages(
      supabase,
      input.conversationId,
      userId
    );
    const message = conversation?.messages?.find((m) => m.id === input.messageId);
    const existingObject = message?.metadata?.campaignObject
      ? deserializeCampaignObject(
          message.metadata.campaignObject as Parameters<typeof deserializeCampaignObject>[0]
        )
      : null;

    const existingShortlistId = existingObject
      ? ((existingObject.sections.creators.data ?? {}) as CreatorsSectionData).linkedShortlistId
      : undefined;

    let shortlistId = existingShortlistId;
    if (!shortlistId) {
      const name = input.campaignName?.trim()
        ? `${input.campaignName.trim()} — Studio picks`
        : "Campaign Studio shortlist";
      const created = await createShortlistV2({ name, visibility: "private" });
      shortlistId = created.id;
    }

    const addResult = await addCreatorsToShortlistsV2({
      shortlistIds: [shortlistId],
      creators: [{ unifiedId: input.creatorUnifiedId }],
    });

    if (!addResult.ok) {
      return { ok: false, message: addResult.message ?? "Could not add creator to shortlist." };
    }

    const next = await persistCampaignObjectOnMessage(
      input.conversationId,
      input.messageId,
      userId,
      (object) =>
        patchCampaignObjectVendorDecisions(
          object,
          input.creatorId,
          "shortlisted",
          shortlistId
        )
    );

    const decisions = (next?.sections.creators.data as CreatorsSectionData | undefined)
      ?.vendorDecisions;

    return {
      ok: true,
      message: addResult.message ?? "Creator added to shortlist.",
      vendorDecisions: decisions,
      linkedShortlistId: shortlistId,
      shortlistUrl: `/discovery/shortlists/${shortlistId}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Shortlist failed.",
    };
  }
}
