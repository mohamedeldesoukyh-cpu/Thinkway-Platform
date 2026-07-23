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
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { applyMediaPlanScheduleChange } from "../media-plan-schedule";

const togglesSchema = z.object({
  salaryCycle: z.boolean().optional(),
  retailSeasons: z.boolean().optional(),
  ramadan: z.boolean().optional(),
  publicHolidays: z.boolean().optional(),
  schoolCalendar: z.boolean().optional(),
  weather: z.boolean().optional(),
  nationalEvents: z.boolean().optional(),
});

const inputSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  marketIntelligence: z.object({
    enabled: z.boolean().optional(),
    toggles: togglesSchema.optional(),
  }),
});

export type UpdateCampaignMarketIntelligenceResult =
  | { ok: true; campaignObject: CampaignObject; change: string }
  | { ok: false; message: string };

/**
 * Persist campaign-wide market intelligence settings (master toggle + factor toggles).
 * Stored on `meta.mediaPlanSchedule.marketIntelligence` — the SSOT read by all output generators.
 * Dependent outputs become stale via the `market_intelligence` input fingerprint; regenerate when ready.
 */
export async function updateCampaignMarketIntelligenceAction(
  input: z.infer<typeof inputSchema>
): Promise<UpdateCampaignMarketIntelligenceResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid market intelligence update." };
  }

  const { campaignObjectId, conversationId, marketIntelligence } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const { data: conversationRow } = await supabase
    .from("ai_conversations")
    .select("context_snapshot")
    .eq("id", conversationId)
    .maybeSingle();

  const row = conversationRow as {
    context_snapshot?: Record<string, unknown> | null;
  } | null;

  const contextSnapshot = (row?.context_snapshot ?? {}) as Record<string, unknown>;
  const restored = await loadCampaignObjectForConversation(
    supabase,
    conversationId,
    contextSnapshot
  );

  if (!restored || restored.id !== campaignObjectId) {
    return { ok: false, message: "Campaign object not found." };
  }

  const scheduleResult = applyMediaPlanScheduleChange(restored, {
    marketIntelligence,
  });

  if (!scheduleResult.change) {
    return { ok: false, message: "Could not update market intelligence settings." };
  }

  const saved = await saveCampaignObject(conversationId, scheduleResult.campaignObject, {
    supabase,
    userId: auth.userId,
    persistToDb: true,
    saveReason: "manual",
  });

  try {
    await updateConversationContextSnapshot(
      supabase,
      conversationId,
      auth.userId,
      attachCampaignObjectToSnapshot(contextSnapshot, saved)
    );
  } catch {
    /* studio message carries the object */
  }

  return {
    ok: true,
    campaignObject: saved,
    change: scheduleResult.change,
  };
}
