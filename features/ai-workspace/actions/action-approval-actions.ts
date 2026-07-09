"use server";

import { revalidatePath } from "next/cache";

import { createCampaignAction } from "@/features/campaigns/actions";
import { createShortlistV2 } from "@/features/discovery/shortlists/actions";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  getConversationWithMessages,
  updateMessageMetadata,
} from "../services/conversation-service";
import type { AiActionCard, AiActionCardStatus } from "../types";

const AI_PATH = "/ai";

async function requireAiUser() {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    throw new Error(auth.error);
  }
  return { supabase, userId: auth.userId };
}

async function recordAiApproval(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  _userId: string,
  card: AiActionCard,
  decision: "approved" | "rejected"
) {
  const docNumber = `AI-${Date.now()}`;
  await supabase.from("approvals").insert({
    document_number: docNumber,
    entity_type: "ai_action",
    entity_id: crypto.randomUUID(),
    title: `[AI ${decision}] ${card.title}`,
    status: decision === "approved" ? "approved" : "rejected",
  });
}

async function executeCampaignCard(
  card: AiActionCard
): Promise<{ ok: true; campaignId?: string } | { ok: false; message: string }> {
  const payload = card.payload;
  const brandId = String(payload.brandId ?? "");
  const name = String(payload.name ?? "AI Campaign");

  if (!brandId) {
    return { ok: false, message: "Brand ID is required to create a campaign." };
  }

  const formData = new FormData();
  formData.set("brand_id", brandId);
  formData.set("name", name);
  formData.set("po_amount", String(payload.poAmount ?? 0));
  formData.set("currency_code", String(payload.currency ?? "USD"));
  formData.set("fx_rate", "1");

  const result = await createCampaignAction({ ok: false, message: "" }, formData);
  if (!result.ok) {
    return { ok: false, message: result.message ?? "Campaign creation failed." };
  }

  return { ok: true };
}

async function executeShortlistCard(
  card: AiActionCard
): Promise<{ ok: true; shortlistId: string } | { ok: false; message: string }> {
  const name = String(card.payload.suggestedName ?? "AI Shortlist");
  const created = await createShortlistV2({ name, visibility: "private" });
  return { ok: true, shortlistId: created.id };
}

export type ActionDecisionResult = {
  ok: boolean;
  message: string;
  cardStatus?: AiActionCardStatus;
  redirectUrl?: string;
};

export async function decideActionCardAction(input: {
  conversationId: string;
  messageId: string;
  cardId: string;
  decision: "approve" | "reject";
}): Promise<ActionDecisionResult> {
  try {
    const { supabase, userId } = await requireAiUser();

    const conversation = await getConversationWithMessages(
      supabase,
      input.conversationId,
      userId
    );
    if (!conversation?.messages) {
      return { ok: false, message: "Conversation not found." };
    }

    const message = conversation.messages.find((m) => m.id === input.messageId);
    if (!message) {
      return { ok: false, message: "Message not found." };
    }

    const cards = [...(message.metadata.actionCards ?? [])];
    const cardIndex = cards.findIndex((c) => c.id === input.cardId);
    if (cardIndex === -1) {
      return { ok: false, message: "Action card not found." };
    }

    const card = cards[cardIndex];

    if (input.decision === "reject") {
      cards[cardIndex] = { ...card, status: "rejected" };
      await updateMessageMetadata(supabase, input.messageId, {
        ...message.metadata,
        actionCards: cards,
      });
      await recordAiApproval(supabase, userId, card, "rejected");
      revalidatePath(AI_PATH);
      return { ok: true, message: "Action rejected.", cardStatus: "rejected" };
    }

    if (!card.requiresApproval) {
      return { ok: false, message: "This action does not require approval." };
    }

    if (card.status !== "pending") {
      return { ok: false, message: `Action already ${card.status}.` };
    }

    let execMessage = "Action approved and executed.";
    let redirectUrl: string | undefined;

    switch (card.type) {
      case "campaign": {
        const result = await executeCampaignCard(card);
        if (!result.ok) return { ok: false, message: result.message };
        execMessage = "Campaign created successfully.";
        redirectUrl = "/campaigns";
        break;
      }
      case "shortlist": {
        const result = await executeShortlistCard(card);
        if (!result.ok) return { ok: false, message: result.message };
        execMessage = "Shortlist created successfully.";
        redirectUrl = `/discovery/shortlists/${result.shortlistId}`;
        break;
      }
      default:
        return {
          ok: false,
          message: `Execution not implemented for action type: ${card.type}`,
        };
    }

    cards[cardIndex] = { ...card, status: "executed" };
    await updateMessageMetadata(supabase, input.messageId, {
      ...message.metadata,
      actionCards: cards,
    });
    await recordAiApproval(supabase, userId, card, "approved");
    revalidatePath(AI_PATH);

    return {
      ok: true,
      message: execMessage,
      cardStatus: "executed",
      redirectUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    return { ok: false, message };
  }
}
