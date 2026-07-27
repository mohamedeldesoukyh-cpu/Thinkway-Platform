"use server";

import { randomUUID } from "crypto";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CREATE_CAMPAIGN_WORKFLOW_ID } from "@/features/campaign-studio/constants/workflow-ids";
import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
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
import { seedFromQuotation } from "../hydration/seed-adapters";
import { getQuotationDetail } from "@/lib/services/quotations/quotation-document-service";
import { generateCampaignOutput, getCampaignOutput, markStaleCampaignOutputs, regenerateStaleCampaignOutputs } from "../output-registry";
import type { CampaignOutputKind } from "../output-types";
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
  return input.seed;
}

async function syncSeedIntoConversation(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  conversationId: string,
  seed: CampaignSeed,
  userId: string,
  options?: { quotationId?: string }
) {
  const existing = await loadCampaignObjectForConversation(supabase, conversationId);
  const hydrated = hydrateCampaignObject(seed, existing ?? undefined, {
    quotationId: options?.quotationId,
  });
  const campaignObject = {
    ...hydrated.campaignObject,
    conversationId,
    workflowId: existing?.workflowId ?? CREATE_CAMPAIGN_WORKFLOW_ID,
    id: existing?.id ?? hydrated.campaignObject.id,
  };

  const saved = await saveCampaignObject(conversationId, campaignObject, {
    supabase,
    userId,
    persistToDb: true,
    saveReason: "manual",
  });

  let objectForStudio = regenerateStaleCampaignOutputs(markStaleCampaignOutputs(saved), {
    origin: "automatic",
  });

  const regenKinds: CampaignOutputKind[] =
    seed.source === "quotation"
      ? ["media_plan"]
      : (["media_plan", "budget_allocation"] as const).filter((kind) =>
          Boolean(getCampaignOutput(objectForStudio, kind))
        );

  for (const kind of regenKinds) {
    // Output generators consume the Media Plan schedule — they must never mutate it.
    ({ campaignObject: objectForStudio } = generateCampaignOutput(objectForStudio, kind, {
      origin: "automatic",
    }));
  }

  if (objectForStudio !== saved) {
    objectForStudio = await saveCampaignObject(conversationId, objectForStudio, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });
  }

  await appendMessage(supabase, {
    conversationId,
    role: "assistant",
    content:
      "Campaign workspace synced from your quotation — creator avatars, ad types, and fees are up to date. The Media Plan calendar has been refreshed from quotation lines.",
    metadata: buildStudioMessageMetadata(objectForStudio),
  });

  try {
    await updateConversationContextSnapshot(
      supabase,
      conversationId,
      userId,
      attachCampaignObjectToSnapshot({}, objectForStudio)
    );
  } catch {
    /* studio message carries the object */
  }
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
    const seed = await resolveLaunchSeed(supabase, input);
    const quotationId =
      input.workspace?.type === "quotation" ? input.workspace.id : undefined;
    const syncOptions = { quotationId };

    if (input.existingConversationId) {
      await syncSeedIntoConversation(
        supabase,
        input.existingConversationId,
        seed,
        auth.userId,
        syncOptions
      );
      return { ok: true, href: workspaceHref(input.existingConversationId, tab), reused: true };
    }

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
        await syncSeedIntoConversation(supabase, existingId, seed, auth.userId, syncOptions);
        return { ok: true, href: workspaceHref(existingId, tab), reused: true };
      }
    }

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
    });

    if (seed.source === "quotation") {
      ({ campaignObject } = generateCampaignOutput(campaignObject, "media_plan", {
        origin: "automatic",
      }));
      campaignObject = await saveCampaignObject(conversation.id, campaignObject, {
        supabase,
        userId: auth.userId,
        persistToDb: true,
        saveReason: "manual",
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
