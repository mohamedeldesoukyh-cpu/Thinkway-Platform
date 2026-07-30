"use server";

import { z } from "zod";

import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { updateConversationContextSnapshot } from "@/features/ai-workspace/services/conversation-service";
import { requirePermission } from "@/lib/auth/permissions-server";
import { resolveCampaignHeaderIdForMediaPlan } from "@/lib/media-plan/log-media-plan-timeline";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { restoreMediaPlanEditOnCampaignObject } from "../media-plan-edit-restore";

const inputSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  editNumber: z.number().int().positive(),
});

export type RestoreMediaPlanEditActionResult =
  | { ok: true; campaignObject: CampaignObject; editNumber: number }
  | { ok: false; message: string };

/**
 * Restore tip content from Edit History (append-only).
 * Never deletes prior edits. May fork a working draft when tip is Approved.
 */
export async function restoreMediaPlanEditAction(
  input: z.infer<typeof inputSchema>
): Promise<RestoreMediaPlanEditActionResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid restore request." };

  const { campaignObjectId, conversationId, campaignId, editNumber } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) return { ok: false, message: auth.error };

  const { data: conversationRow } = await supabase
    .from("ai_conversations")
    .select("context_snapshot")
    .eq("id", conversationId)
    .maybeSingle();

  const contextSnapshot = ((conversationRow as {
    context_snapshot?: Record<string, unknown> | null;
  } | null)?.context_snapshot ?? {}) as Record<string, unknown>;

  const restored = await loadCampaignObjectForConversation(
    supabase,
    conversationId,
    contextSnapshot
  );
  if (!restored || restored.id !== campaignObjectId) {
    return { ok: false, message: "Campaign object not found." };
  }

  const result = restoreMediaPlanEditOnCampaignObject(restored, editNumber, {
    actorUserId: auth.userId,
  });
  if ("ok" in result && result.ok === false) {
    return { ok: false, message: result.message };
  }
  if (!("campaignObject" in result)) {
    return { ok: false, message: "Restore failed." };
  }

  const headerId = await resolveCampaignHeaderIdForMediaPlan(
    supabase,
    campaignObjectId,
    campaignId
  );

  const saved = await saveCampaignObject(conversationId, result.campaignObject, {
    supabase,
    userId: auth.userId,
    persistToDb: true,
    saveReason: "manual",
    campaignHeaderId: headerId,
  });

  try {
    await updateConversationContextSnapshot(
      supabase,
      conversationId,
      auth.userId,
      attachCampaignObjectToSnapshot(contextSnapshot, saved)
    );
  } catch {
    /* non-fatal */
  }

  return { ok: true, campaignObject: saved, editNumber };
}
