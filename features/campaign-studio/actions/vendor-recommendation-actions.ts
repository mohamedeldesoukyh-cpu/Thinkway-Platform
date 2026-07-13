"use server";

import { createShortlistV2, addCreatorsToShortlistsV2 } from "@/features/discovery/shortlists/actions";
import { getConversationWithMessages } from "@/features/ai-workspace/services/conversation-service";
import {
  deserializeCampaignObject,
} from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { stageStudioDraftChangeAction } from "./studio-draft-actions";
import { requireStudioUser } from "./persist-campaign-object-on-message";

export type VendorRecommendationDecision = "approved" | "rejected" | "shortlisted";

export type VendorRecommendationActionResult = {
  ok: boolean;
  message: string;
  vendorDecisions?: Record<string, VendorRecommendationDecision>;
  linkedShortlistId?: string;
  shortlistUrl?: string;
  draft?: import("@/features/campaign-intelligence/types/section-schemas").StudioDraftState;
};

export async function decideVendorRecommendationAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  decision: "approved" | "rejected";
  displayName?: string;
}): Promise<VendorRecommendationActionResult> {
  try {
    const kind = input.decision === "approved" ? "approve_creator" : "reject_creator";
    const result = await stageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      change: {
        kind,
        creatorId: input.creatorId,
        displayName: input.displayName,
      },
    });

    if (!result.ok) return { ok: false, message: result.message };

    const previewDecisions: Record<string, VendorRecommendationDecision> = {};
    for (const change of result.draft?.changes ?? []) {
      if (change.kind === "approve_creator") previewDecisions[change.creatorId] = "approved";
      if (change.kind === "reject_creator") previewDecisions[change.creatorId] = "rejected";
    }

    return {
      ok: true,
      message:
        input.decision === "approved"
          ? "Approval staged — apply changes to commit."
          : "Rejection staged — apply changes to commit.",
      vendorDecisions: previewDecisions,
      draft: result.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stage decision.",
    };
  }
}

export async function stageVendorRoleAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  role: "main" | "alternative";
  displayName?: string;
}): Promise<VendorRecommendationActionResult> {
  try {
    const kind = input.role === "main" ? "promote_main" : "demote_alternative";
    const result = await stageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      change: {
        kind,
        creatorId: input.creatorId,
        displayName: input.displayName,
      },
    });
    if (!result.ok) return { ok: false, message: result.message };
    return {
      ok: true,
      message:
        input.role === "main"
          ? "Promote to main staged — apply changes to commit."
          : "Move to alternatives staged — apply changes to commit.",
      draft: result.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stage role change.",
    };
  }
}

export async function shortlistVendorRecommendationAction(input: {
  conversationId: string;
  messageId: string;
  creatorId: string;
  creatorUnifiedId: string;
  campaignName?: string;
  displayName?: string;
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

    // Discovery shortlist write is external UX only — Campaign Plan slate state stages until Apply.
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

    const stageResult = await stageStudioDraftChangeAction({
      conversationId: input.conversationId,
      messageId: input.messageId,
      change: {
        kind: "shortlist_creator",
        creatorId: input.creatorId,
        displayName: input.displayName,
        linkedShortlistId: shortlistId,
      },
    });

    if (!stageResult.ok) return { ok: false, message: stageResult.message };

    const previewDecisions: Record<string, VendorRecommendationDecision> = {};
    for (const change of stageResult.draft?.changes ?? []) {
      if (change.kind === "shortlist_creator") previewDecisions[change.creatorId] = "shortlisted";
      if (change.kind === "approve_creator") previewDecisions[change.creatorId] = "approved";
      if (change.kind === "reject_creator") previewDecisions[change.creatorId] = "rejected";
    }

    return {
      ok: true,
      message: "Shortlist staged — apply changes to commit to the campaign plan.",
      vendorDecisions: previewDecisions,
      linkedShortlistId: shortlistId,
      shortlistUrl: `/discovery/shortlists/${shortlistId}`,
      draft: stageResult.draft,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Shortlist failed.",
    };
  }
}
