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
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";
import { assertScheduleMoveAllowedByAssignmentGrain } from "@/lib/media-plan/grain-lock-guards";
import {
  logMediaPlanTimelineEvents,
  resolveCampaignHeaderIdForMediaPlan,
} from "@/lib/media-plan/log-media-plan-timeline";
import { performanceFactsFromAssignmentHierarchy } from "@/lib/media-plan/performance-facts";
import { asMediaPlanData } from "../generators/media-plan";
import {
  MediaPlanCampaignWindowError,
  assertMediaPlanWithinCampaignWindow,
} from "../media-plan-campaign-window";
import { generateCampaignOutput, getCampaignOutputState } from "../output-registry";
import { mutateMediaPlanSchedule } from "../media-plan-mutations";

const moveSchema = z.object({
  creatorId: z.string().min(1),
  fromWeek: z.number().int().min(1).max(52),
  fromDayIndex: z.number().int().min(0).max(6),
  toWeek: z.number().int().min(1).max(52),
  toDayIndex: z.number().int().min(0).max(6),
  /** Omit for whole-creator move; required when moving selected deliverable types. */
  deliverableTypes: z.array(z.string().min(1)).optional(),
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

  // Release 2.1 — protect live / locked Assignment grains before schedule mutation.
  const headerIdForGuard = await resolveCampaignHeaderIdForMediaPlan(
    supabase,
    campaignObjectId,
    campaignId
  );
  if (headerIdForGuard) {
    try {
      const hierarchy = await getCampaignAssignmentHierarchy(headerIdForGuard);
      const facts = performanceFactsFromAssignmentHierarchy(hierarchy);
      const slateCreator = resolveSlate(restored).find(
        (entry) => entry.creatorId.trim().toLowerCase() === move.creatorId.trim().toLowerCase()
      );
      const guard = assertScheduleMoveAllowedByAssignmentGrain(facts, {
        creatorIds: [move.creatorId],
        campaignLineIds: slateCreator?.campaignLineId
          ? [slateCreator.campaignLineId]
          : undefined,
        deliverableTypes: move.deliverableTypes,
      });
      if (!guard.ok) {
        return { ok: false, message: guard.message };
      }
    } catch {
      /* hierarchy load failure must not block edits when Assignment facts unavailable */
    }
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
    // Schedule slot moves are a Revise: keep structure, sync the calendar view.
    ({ campaignObject: next } = generateCampaignOutput(next, "media_plan", {
      origin: "user",
      actorUserId: auth.userId,
      operation: "revise",
      changeSummary:
        "Revised Media Plan: publishing slots updated — creators, waves, and strategy preserved.",
    }));
    const generated = asMediaPlanData(
      getCampaignOutputState(next).media_plan?.content?.data
    );
    if (generated) assertMediaPlanWithinCampaignWindow(generated);
  } catch (error) {
    if (error instanceof MediaPlanCampaignWindowError) {
      return { ok: false, message: error.message };
    }
    /* keep schedule meta even if regeneration fails for other reasons */
  }

  const headerIdForSave = await resolveCampaignHeaderIdForMediaPlan(
    supabase,
    campaignObjectId,
    campaignId
  );

  const saved = await saveCampaignObject(conversationId, next, {
    supabase,
    userId: auth.userId,
    persistToDb: true,
    saveReason: "manual",
    campaignHeaderId: headerIdForSave,
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
    const headerId = headerIdForSave;
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
