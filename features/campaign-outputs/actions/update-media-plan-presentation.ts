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
import {
  mergeMediaPlanPresentation,
  type MediaPlanPresentationPatch,
} from "../media-plan-presentation";

const sectionVisibilityPatchSchema = z
  .object({
    executiveSummary: z.boolean(),
    objectives: z.boolean(),
    platformIntelligence: z.boolean(),
    creatorMix: z.boolean(),
    weeklyObjectives: z.boolean(),
    creativeDirection: z.boolean(),
    influencerConcepts: z.boolean(),
    publishingCalendar: z.boolean(),
    campaignOperations: z.boolean(),
    productionSchedule: z.boolean(),
    marketTiming: z.boolean(),
  })
  .partial();

const creativeDirectionSubsectionPatchSchema = z
  .object({
    thinkwayRecommendations: z.boolean(),
    uploadedConcepts: z.boolean(),
    creatorContentTypes: z.boolean(),
    influencerConcepts: z.boolean(),
  })
  .partial();

const presentationSchema: z.ZodType<MediaPlanPresentationPatch> = z.object({
  mode: z.enum(["standard", "strategy"]).optional(),
  view: z.enum(["internal", "client"]).optional(),
  influencerConceptsExport: z.enum(["summary", "full", "none"]).optional(),
  sections: sectionVisibilityPatchSchema.optional(),
  creativeDirectionSubsections: creativeDirectionSubsectionPatchSchema.optional(),
  exportLanguage: z.enum(["en", "ar", "bilingual"]).optional(),
  includeProductionSchedule: z.boolean().optional(),
  includeInternalNotes: z.boolean().optional(),
});

const inputSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  presentation: presentationSchema,
});

export type UpdateMediaPlanPresentationResult =
  | { ok: true; campaignObject: CampaignObject }
  | { ok: false; message: string };

/** Persist media plan presentation toggles (section visibility, standard/strategy mode). */
export async function updateMediaPlanPresentationAction(
  input: z.infer<typeof inputSchema>
): Promise<UpdateMediaPlanPresentationResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid presentation update." };
  }

  const { campaignObjectId, conversationId, presentation } = parsed.data;

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

  const contextSnapshot = ((conversationRow as { context_snapshot?: Record<string, unknown> } | null)
    ?.context_snapshot ?? {}) as Record<string, unknown>;

  const restored = await loadCampaignObjectForConversation(
    supabase,
    conversationId,
    contextSnapshot
  );

  if (!restored || restored.id !== campaignObjectId) {
    return { ok: false, message: "Campaign object not found." };
  }

  const mergedPresentation = mergeMediaPlanPresentation(
    restored.meta.mediaPlanPresentation,
    presentation
  );

  const campaignObject: CampaignObject = {
    ...restored,
    meta: {
      ...restored.meta,
      mediaPlanPresentation: mergedPresentation,
    },
    updatedAt: new Date().toISOString(),
  };

  const saved = await saveCampaignObject(conversationId, campaignObject, {
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

  return { ok: true, campaignObject: saved };
}
