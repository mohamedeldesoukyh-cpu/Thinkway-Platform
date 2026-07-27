"use server";

import { z } from "zod";

import { serializeCampaignObject } from "@/features/campaign-intelligence";
import { loadCampaignObjectForConversation } from "@/features/campaign-intelligence";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { syncLatestStudioMessageCampaignObject } from "@/features/ai-workspace/services/conversation-campaign-hydration";
import { getOutputDefinition } from "@/features/campaign-outputs/output-catalog";
import {
  regeneratableStaleCampaignOutputKinds,
  regenerateStaleCampaignOutputs,
} from "@/features/campaign-outputs/output-registry";
import type { CampaignOutputKind } from "@/features/campaign-outputs/output-types";
import { requireStudioUser } from "@/features/campaign-studio/actions/persist-campaign-object-on-message";

const inputSchema = z.object({
  conversationId: z.string().uuid(),
  campaignObjectId: z.string().uuid(),
});

export type RegenerateStaleOutputsResult =
  | {
      ok: true;
      campaignObject: Record<string, unknown>;
      regenerated: CampaignOutputKind[];
      message: string;
    }
  | { ok: false; message: string };

/**
 * Rebuild every stale, generatable output in catalog order (Strategy → Planning
 * → Client → Internal) and persist to the campaign workspace.
 */
export async function regenerateStaleOutputsAction(
  input: z.infer<typeof inputSchema>
): Promise<RegenerateStaleOutputsResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { conversationId, campaignObjectId } = parsed.data;

  try {
    const { userId, supabase } = await requireStudioUser();
    const restored = await loadCampaignObjectForConversation(supabase, conversationId);

    if (!restored || restored.id !== campaignObjectId) {
      return { ok: false, message: "Campaign workspace not found." };
    }

    const kinds = regeneratableStaleCampaignOutputKinds(restored);
    if (kinds.length === 0) {
      return { ok: false, message: "No outputs need updating right now." };
    }

    // Stale output refresh rebuilds views only — it must not fork Media Plan drafts
    // or mutate mediaPlanSchedule. Explicit Media Plan regenerate uses prepareMediaPlanRegenerate.
    const regenerated = regenerateStaleCampaignOutputs(restored, { origin: "user" });
    const saved = await saveCampaignObject(conversationId, regenerated, {
      supabase,
      userId,
      persistToDb: true,
      saveReason: "manual",
    });

    await syncLatestStudioMessageCampaignObject(supabase, conversationId, userId, saved);

    const labels = kinds.map((kind) => getOutputDefinition(kind)?.label ?? kind);
    const message =
      labels.length === 1
        ? `Regenerated ${labels[0]}.`
        : `Regenerated ${labels.length} outputs in sequence: ${labels.join(" → ")}.`;

    return {
      ok: true,
      campaignObject: serializeCampaignObject(saved) as unknown as Record<string, unknown>,
      regenerated: kinds,
      message,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to regenerate outputs.",
    };
  }
}
