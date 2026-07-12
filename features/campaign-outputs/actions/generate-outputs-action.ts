"use server";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATE_CAMPAIGN_WORKFLOW_ID } from "@/features/campaign-studio/constants/workflow-ids";
import { attachCampaignObjectToSnapshot } from "@/features/campaign-intelligence";
import {
  createConversation,
  appendMessage,
  updateConversationContextSnapshot,
} from "@/features/ai-workspace/services/conversation-service";

import type { CampaignSeed } from "../hydration/hydration-types";
import { hydrateCampaignObject } from "../hydration/hydrate";
import { buildStudioMessageMetadata, workspaceHref, type StudioTab } from "./campaign-workspace-message";

export type StartCampaignOutputsInput = {
  /** The source, normalized via the existing seed adapters. */
  seed: CampaignSeed;
  /**
   * If the source already has a Campaign workspace, its conversation id. When
   * present we REUSE it — no new conversation, no new Campaign Object.
   */
  existingConversationId?: string;
  /** Which mounted tab to open into. */
  tab?: StudioTab;
  /** Optional workspace routing context to persist on the conversation. */
  workspace?: { type?: string; id?: string };
};

export type StartCampaignOutputsResult =
  | { ok: true; href: string; reused: boolean }
  | { ok: false; message: string };

/**
 * Open the Campaign Outputs workspace from a business page.
 *
 * Existing campaign → reuse it (open the existing conversation). Otherwise
 * create ONE conversation, hydrate the Campaign Object from the seed, and seed
 * a single studio message — reusing the exact conversation service, hydration,
 * serialization, and context-snapshot path the chat route already uses. The user
 * lands in the existing Studio with the Outputs Center and Copilot ready.
 */
export async function startCampaignOutputsFromSeed(
  input: StartCampaignOutputsInput
): Promise<StartCampaignOutputsResult> {
  const tab: StudioTab = input.tab ?? "outputs";

  // Existing campaign — never create another one.
  if (input.existingConversationId) {
    return { ok: true, href: workspaceHref(input.existingConversationId, tab), reused: true };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) return { ok: false, message: auth.error };

  try {
    // Reuse an existing workspace conversation for this source, if one exists —
    // never create a second Campaign workspace for the same business object.
    if (input.workspace?.id) {
      const { data: existing } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("created_by", auth.userId)
        .eq("workspace_type", input.workspace.type ?? "general")
        .eq("workspace_id", input.workspace.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const existingId = (existing as { id?: string } | null)?.id;
      if (existingId) {
        return { ok: true, href: workspaceHref(existingId, tab), reused: true };
      }
    }

    const conversation = await createConversation(supabase, auth.userId, {
      workspaceType: input.workspace?.type ?? "general",
      workspaceId: input.workspace?.id,
    });

    // Hydrate the Campaign Object from the source and bind it to this conversation.
    const hydrated = hydrateCampaignObject(input.seed);
    const campaignObject = {
      ...hydrated.campaignObject,
      conversationId: conversation.id,
      workflowId: CREATE_CAMPAIGN_WORKFLOW_ID,
    };

    // Seed a single studio message so the existing Studio renders the workspace.
    await appendMessage(supabase, {
      conversationId: conversation.id,
      role: "assistant",
      content: "Your campaign workspace is ready. Generate outputs, ask the Copilot, or open the Director for recommendations.",
      metadata: buildStudioMessageMetadata(campaignObject),
    });

    // Mirror the chat route: keep the Campaign Object on the conversation snapshot
    // so the Copilot operates on it (single source of truth).
    try {
      await updateConversationContextSnapshot(
        supabase,
        conversation.id,
        auth.userId,
        attachCampaignObjectToSnapshot({}, campaignObject)
      );
    } catch {
      // Non-fatal — the studio message already carries the object.
    }

    return { ok: true, href: workspaceHref(conversation.id, tab), reused: false };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to open the campaign workspace",
    };
  }
}
