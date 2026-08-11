"use server";

import { randomUUID } from "crypto";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATE_CAMPAIGN_WORKFLOW_ID } from "@/features/campaign-studio/constants/workflow-ids";
import {
  attachCampaignObjectToSnapshot,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import {
  createConversation,
  appendMessage,
  updateConversationContextSnapshot,
} from "@/features/ai-workspace/services/conversation-service";

import type { CampaignSeed } from "../hydration/hydration-types";
import { hydrateCampaignObject } from "../hydration/hydrate";
import { seedCreatorsFromAssignmentHierarchy } from "../hydration/seed-from-assignment-hierarchy";
import { seedFromQuotation } from "../hydration/seed-adapters";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";
import { generateCampaignOutput } from "../output-registry";
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

async function resolveLaunchSeed(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  input: StartCampaignOutputsInput
): Promise<CampaignSeed> {
  if (input.workspace?.type === "quotation" && input.workspace.id) {
    const detail = await getQuotationDetail(supabase, input.workspace.id);
    if (detail) return seedFromQuotation(detail);
  }

  // CRM campaign → fill empty Studio slate from Assignments hierarchy.
  if (
    input.workspace?.type === "campaign" &&
    input.workspace.id &&
    input.seed.creators.length === 0
  ) {
    try {
      const hierarchy = await getCampaignAssignmentHierarchy(input.workspace.id);
      const creators = seedCreatorsFromAssignmentHierarchy(hierarchy);
      if (creators.length > 0) {
        return { ...input.seed, creators };
      }
    } catch {
      /* launch must still open Studio even if hierarchy load fails */
    }
  }

  return input.seed;
}

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

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) return { ok: false, message: auth.error };

  try {
    if (input.existingConversationId) {
      // Fast path: conversation already linked (e.g. Media Plan → Open in Studio).
      // Full sync regenerates outputs + appends a message and can hang for large
      // plans (DEF-UX-05). Tip state is already persisted via Media Plan saves.
      return {
        ok: true,
        href: workspaceHref(input.existingConversationId, tab),
        reused: true,
      };
    }

    // Reuse an existing workspace conversation before any hierarchy/media-plan work —
    // Campaign hero "Open Studio" previously timed out on syncSeedIntoConversation.
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

    const seed = await resolveLaunchSeed(supabase, input);
    const quotationId =
      input.workspace?.type === "quotation" ? input.workspace.id : undefined;
    const campaignHeaderId =
      input.workspace?.type === "campaign" ? input.workspace.id : undefined;
    const syncOptions = { quotationId, campaignHeaderId };

    const conversation = await createConversation(supabase, auth.userId, {
      workspaceType: input.workspace?.type ?? "general",
      workspaceId: input.workspace?.id,
    });

    const hydrated = hydrateCampaignObject(seed, undefined, syncOptions);
    let campaignObject: CampaignObject = {
      ...hydrated.campaignObject,
      id: randomUUID(),
      conversationId: conversation.id,
      workflowId: CREATE_CAMPAIGN_WORKFLOW_ID,
    };

    campaignObject = await saveCampaignObject(conversation.id, campaignObject, {
      supabase,
      userId: auth.userId,
      persistToDb: true,
      saveReason: "manual",
      campaignHeaderId,
    });

    // Quotation → refresh Media Plan from lines. CRM campaign → hydrate creators only;
    // regenerating Media Plan for large assignment sets blocks Open Studio.
    if (seed.source === "quotation") {
      ({ campaignObject } = generateCampaignOutput(campaignObject, "media_plan", {
        origin: "automatic",
      }));
      campaignObject = await saveCampaignObject(conversation.id, campaignObject, {
        supabase,
        userId: auth.userId,
        persistToDb: true,
        saveReason: "manual",
        campaignHeaderId,
      });
    }

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
