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
  logMediaPlanTimelineEvents,
  resolveCampaignHeaderIdForMediaPlan,
} from "@/lib/media-plan/log-media-plan-timeline";
import { generateCampaignOutput } from "../output-registry";
import { mutateMediaPlanSchedule } from "../media-plan-mutations";

const moveSchema = z.object({
  creatorId: z.string().min(1),
  fromWeek: z.number().int().min(1).max(52),
  fromDayIndex: z.number().int().min(0).max(6),
  toWeek: z.number().int().min(1).max(52),
  toDayIndex: z.number().int().min(0).max(6),
  deliverableTypes: z.array(z.string().min(1)).min(1),
  remainingTypes: z.array(z.string().min(1)).optional(),
});

const inputSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  move: moveSchema,
});

export type UpdateMediaPlanScheduleResult =
  | { ok: true; campaignObject: CampaignObject; change: string }
  | { ok: false; message: string };

/**
 * Persist a manual creator slot move from the media plan preview calendar.
 * Regenerates the media plan output so preview and exports stay in sync.
 */
export async function updateMediaPlanScheduleAction(
  input: z.infer<typeof inputSchema>
): Promise<UpdateMediaPlanScheduleResult> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid schedule update." };
  }

  const { campaignObjectId, conversationId, campaignId, move } = parsed.data;

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

  const scheduleResult = mutateMediaPlanSchedule(
    restored,
    {
      moveCreators: [
        {
          creatorIds: [move.creatorId],
          fromWeek: move.fromWeek,
          fromDayIndex: move.fromDayIndex,
          toWeek: move.toWeek,
          toDayIndex: move.toDayIndex,
          deliverableTypes: move.deliverableTypes,
          remainingTypes: move.remainingTypes,
        },
      ],
    },
    {
      source: "studio_media_plan_ui",
      actorUserId: auth.userId,
      autoForkDraft: true,
    }
  );

  if (!scheduleResult.ok) {
    return { ok: false, message: scheduleResult.message };
  }

  if (!scheduleResult.change) {
    return { ok: false, message: "Could not move creator — check the target week." };
  }

  let next = scheduleResult.campaignObject;
  try {
    ({ campaignObject: next } = generateCampaignOutput(next, "media_plan", {
      origin: "user",
    }));
  } catch {
    /* keep schedule meta even if regeneration fails */
  }

  const saved = await saveCampaignObject(conversationId, next, {
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

  // Timeline: only lifecycle-worthy events (e.g. draft fork), not every drag.
  try {
    const headerId = await resolveCampaignHeaderIdForMediaPlan(
      supabase,
      campaignObjectId,
      campaignId
    );
    if (headerId && scheduleResult.events.length) {
      await logMediaPlanTimelineEvents(supabase, {
        campaignHeaderId: headerId,
        campaignObjectId,
        actorId: auth.userId,
        events: scheduleResult.events,
      });
    }
  } catch {
    /* timeline logging must not fail the mutation */
  }

  return {
    ok: true,
    campaignObject: saved,
    change: scheduleResult.change,
  };
}
