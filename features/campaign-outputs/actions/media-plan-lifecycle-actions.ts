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
import {
  logMediaPlanTimelineEvents,
  resolveCampaignHeaderIdForMediaPlan,
} from "@/lib/media-plan/log-media-plan-timeline";
import type { MediaPlanTimelineEvent } from "@/lib/media-plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  approveMediaPlanOnCampaignObject,
  lockMediaPlanOnCampaignObject,
  rejectMediaPlanOnCampaignObject,
  requestChangesMediaPlanOnCampaignObject,
  unlockMediaPlanOnCampaignObject,
} from "../media-plan-mutations";

const baseSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  /** Optional campaign header id — preferred for Timeline Activity feed. */
  campaignId: z.string().uuid().optional(),
});

export type MediaPlanLifecycleActionResult =
  | { ok: true; campaignObject: CampaignObject; change: string }
  | { ok: false; message: string };

async function loadEditableObject(
  campaignObjectId: string,
  conversationId: string
): Promise<
  | {
      ok: true;
      restored: CampaignObject;
      supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
      userId: string;
      contextSnapshot: Record<string, unknown>;
    }
  | { ok: false; message: string }
> {
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

  return {
    ok: true,
    restored,
    supabase,
    userId: auth.userId,
    contextSnapshot,
  };
}

async function persist(
  conversationId: string,
  campaignObject: CampaignObject,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  contextSnapshot: Record<string, unknown>
): Promise<CampaignObject> {
  const saved = await saveCampaignObject(conversationId, campaignObject, {
    supabase,
    userId,
    persistToDb: true,
    saveReason: "manual",
  });
  try {
    await updateConversationContextSnapshot(
      supabase,
      conversationId,
      userId,
      attachCampaignObjectToSnapshot(contextSnapshot, saved)
    );
  } catch {
    /* studio message carries the object */
  }
  return saved;
}

async function persistWithTimeline(input: {
  conversationId: string;
  campaignObjectId: string;
  campaignId?: string | null;
  campaignObject: CampaignObject;
  events: MediaPlanTimelineEvent[];
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  contextSnapshot: Record<string, unknown>;
}): Promise<CampaignObject> {
  const saved = await persist(
    input.conversationId,
    input.campaignObject,
    input.supabase,
    input.userId,
    input.contextSnapshot
  );

  const headerId = await resolveCampaignHeaderIdForMediaPlan(
    input.supabase,
    input.campaignObjectId,
    input.campaignId
  );
  if (headerId) {
    try {
      await logMediaPlanTimelineEvents(input.supabase, {
        campaignHeaderId: headerId,
        campaignObjectId: input.campaignObjectId,
        actorId: input.userId,
        events: input.events,
      });
    } catch {
      /* timeline logging must not fail the mutation */
    }
  }

  return saved;
}

/** Lock the working draft Media Plan (awaiting client approval). */
export async function lockMediaPlanAction(
  input: z.infer<typeof baseSchema>
): Promise<MediaPlanLifecycleActionResult> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadEditableObject(
    parsed.data.campaignObjectId,
    parsed.data.conversationId
  );
  if (!loaded.ok) return loaded;

  const result = lockMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not lock Media Plan." : result.message };
  }

  const saved = await persistWithTimeline({
    conversationId: parsed.data.conversationId,
    campaignObjectId: parsed.data.campaignObjectId,
    campaignId: parsed.data.campaignId,
    campaignObject: result.campaignObject,
    events: result.events,
    supabase: loaded.supabase,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });
  return { ok: true, campaignObject: saved, change: result.change };
}

/** Unlock locked draft, or fork a new draft from an approved baseline. */
export async function unlockMediaPlanAction(
  input: z.infer<typeof baseSchema> & { reason?: string }
): Promise<MediaPlanLifecycleActionResult> {
  const schema = baseSchema.extend({ reason: z.string().max(2000).optional() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadEditableObject(
    parsed.data.campaignObjectId,
    parsed.data.conversationId
  );
  if (!loaded.ok) return loaded;

  const result = unlockMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
    reason: parsed.data.reason,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not unlock Media Plan." : result.message };
  }

  const saved = await persistWithTimeline({
    conversationId: parsed.data.conversationId,
    campaignObjectId: parsed.data.campaignObjectId,
    campaignId: parsed.data.campaignId,
    campaignObject: result.campaignObject,
    events: result.events,
    supabase: loaded.supabase,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });
  return { ok: true, campaignObject: saved, change: result.change };
}

/** Promote working draft to Current Approved Baseline (client or on-behalf). */
export async function approveMediaPlanAction(
  input: z.infer<typeof baseSchema> & {
    method: "client_portal" | "on_behalf";
    approvalSource?: "email" | "whatsapp" | "phone" | "meeting" | "other";
    notes?: string;
  }
): Promise<MediaPlanLifecycleActionResult> {
  const schema = baseSchema.extend({
    method: z.enum(["client_portal", "on_behalf"]),
    approvalSource: z.enum(["email", "whatsapp", "phone", "meeting", "other"]).optional(),
    notes: z.string().max(4000).optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadEditableObject(
    parsed.data.campaignObjectId,
    parsed.data.conversationId
  );
  if (!loaded.ok) return loaded;

  const result = approveMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
    method: parsed.data.method,
    approvalSource: parsed.data.approvalSource,
    notes: parsed.data.notes,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not approve Media Plan." : result.message };
  }

  const saved = await persistWithTimeline({
    conversationId: parsed.data.conversationId,
    campaignObjectId: parsed.data.campaignObjectId,
    campaignId: parsed.data.campaignId,
    campaignObject: result.campaignObject,
    events: result.events,
    supabase: loaded.supabase,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });
  return { ok: true, campaignObject: saved, change: result.change };
}

/** Request changes on locked/approved plan — opens or continues Working Draft. */
export async function requestMediaPlanChangesAction(
  input: z.infer<typeof baseSchema> & { notes?: string }
): Promise<MediaPlanLifecycleActionResult> {
  const schema = baseSchema.extend({ notes: z.string().max(4000).optional() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadEditableObject(
    parsed.data.campaignObjectId,
    parsed.data.conversationId
  );
  if (!loaded.ok) return loaded;

  const result = requestChangesMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
    notes: parsed.data.notes,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not request changes." : result.message };
  }

  const saved = await persistWithTimeline({
    conversationId: parsed.data.conversationId,
    campaignObjectId: parsed.data.campaignObjectId,
    campaignId: parsed.data.campaignId,
    campaignObject: result.campaignObject,
    events: result.events,
    supabase: loaded.supabase,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });
  return { ok: true, campaignObject: saved, change: result.change };
}

/** Reject a locked plan awaiting approval. */
export async function rejectMediaPlanAction(
  input: z.infer<typeof baseSchema> & { notes?: string }
): Promise<MediaPlanLifecycleActionResult> {
  const schema = baseSchema.extend({ notes: z.string().max(4000).optional() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadEditableObject(
    parsed.data.campaignObjectId,
    parsed.data.conversationId
  );
  if (!loaded.ok) return loaded;

  const result = rejectMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
    notes: parsed.data.notes,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not reject Media Plan." : result.message };
  }

  const saved = await persistWithTimeline({
    conversationId: parsed.data.conversationId,
    campaignObjectId: parsed.data.campaignObjectId,
    campaignId: parsed.data.campaignId,
    campaignObject: result.campaignObject,
    events: result.events,
    supabase: loaded.supabase,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });
  return { ok: true, campaignObject: saved, change: result.change };
}
