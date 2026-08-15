"use server";

import { serializeCampaignObject } from "@/features/campaign-intelligence";
import {
  loadCampaignObjectFromPersistence,
  saveCampaignObject,
} from "@/features/campaign-intelligence/services/campaign-object-store";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import {
  confirmCampaignIntelligenceProfile,
  projectConfirmedCampaignFacts,
} from "@/features/campaign-intelligence-profile/services/campaign-facts-spine";
import {
  getCampaignIntelligenceProfileById,
  getCampaignIntelligenceProfileForConversation,
  updateCampaignIntelligenceProfile,
} from "@/features/campaign-intelligence-profile/services/profile-repository";
import { normalizeCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/services/normalize-profile";
import { syncLatestStudioMessageCampaignObject } from "@/features/ai-workspace/services/conversation-campaign-hydration";
import { getConversationWithMessages } from "@/features/ai-workspace/services/conversation-service";

import {
  applyIntakeFactsEdit,
  confirmStudioIntakeOnCampaignObject,
  requiredIntakeFacts,
  type IntakeFactsEdit,
} from "../services/studio-intake-facts";
import { campaignObjectFromLatestStudioMessage } from "../services/resolve-campaign-object-for-edit";
import { requireStudioUser } from "./persist-campaign-object-on-message";

export type ConfirmStudioIntakeInput = {
  conversationId: string;
  profileId?: string;
};

export type ConfirmStudioIntakeResult =
  | { ok: true; message: string; campaignObject: Record<string, unknown> }
  | { ok: false; message: string };

async function loadCanonicalCampaignObject(
  conversationId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof requireStudioUser>>["supabase"]
) {
  const conversation = await getConversationWithMessages(supabase, conversationId, userId);
  if (!conversation) return null;
  const contextSnapshot = (conversation.contextSnapshot ?? {}) as Record<string, unknown>;
  const fromPersistence = await loadCampaignObjectFromPersistence(
    supabase,
    conversationId,
    contextSnapshot
  );
  return fromPersistence ?? campaignObjectFromLatestStudioMessage(conversation.messages);
}

export async function confirmStudioIntakeAction(
  input: ConfirmStudioIntakeInput
): Promise<ConfirmStudioIntakeResult> {
  try {
    const { userId, supabase } = await requireStudioUser();
    const canonical = await loadCanonicalCampaignObject(input.conversationId, userId, supabase);
    if (!canonical) {
      return { ok: false, message: "Could not find the campaign workspace to confirm." };
    }

    let facts = getCampaignFacts(canonical);
    const profileId =
      input.profileId ??
      (await getCampaignIntelligenceProfileForConversation(supabase, input.conversationId))?.id;

    if (profileId) {
      const row = await getCampaignIntelligenceProfileById(supabase, profileId);
      if (row) {
        const confirmed = confirmCampaignIntelligenceProfile(
          normalizeCampaignIntelligenceProfile(row.profile)
        );
        const projected = projectConfirmedCampaignFacts(confirmed);
        if (!projected) {
          return { ok: false, message: "Campaign intelligence could not be confirmed." };
        }
        await updateCampaignIntelligenceProfile(supabase, profileId, {
          userId,
          profile: confirmed,
          status: "saved",
          title: confirmed.campaignName ?? confirmed.brandName ?? undefined,
        });
        facts = projected;
      }
    }

    const intake = requiredIntakeFacts(facts);
    if (!intake.canConfirm || !facts) {
      const missing = intake.missing.map((row) => row.label).join(", ") || "required campaign facts";
      return { ok: false, message: `Confirm is blocked until these facts are present: ${missing}.` };
    }

    const next = confirmStudioIntakeOnCampaignObject(canonical, facts);
    const saved = await saveCampaignObject(input.conversationId, next, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });
    await syncLatestStudioMessageCampaignObject(supabase, input.conversationId, userId, saved);

    return {
      ok: true,
      message: "Campaign confirmed. Strategy can now use these facts.",
      campaignObject: serializeCampaignObject(saved) as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to confirm campaign facts.",
    };
  }
}

export async function patchStudioIntakeFactsAction(input: {
  conversationId: string;
  edit: IntakeFactsEdit;
}): Promise<ConfirmStudioIntakeResult> {
  try {
    const { userId, supabase } = await requireStudioUser();
    const canonical = await loadCanonicalCampaignObject(input.conversationId, userId, supabase);
    if (!canonical) {
      return { ok: false, message: "Could not find the campaign workspace to update." };
    }
    if (!getCampaignFacts(canonical)) {
      return { ok: false, message: "Upload or extract a brief before editing campaign facts." };
    }

    const next = applyIntakeFactsEdit(canonical, input.edit);
    const saved = await saveCampaignObject(input.conversationId, next, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });
    await syncLatestStudioMessageCampaignObject(supabase, input.conversationId, userId, saved);

    return {
      ok: true,
      message: "Campaign facts updated. Dependent recommendations may be outdated.",
      campaignObject: serializeCampaignObject(saved) as unknown as Record<string, unknown>,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to update campaign facts.",
    };
  }
}
