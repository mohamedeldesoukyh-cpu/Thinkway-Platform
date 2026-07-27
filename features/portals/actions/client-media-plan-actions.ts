"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  attachCampaignObjectToSnapshot,
  loadCampaignObjectForConversation,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import { updateConversationContextSnapshot } from "@/features/ai-workspace/services/conversation-service";
import {
  approveMediaPlanOnCampaignObject,
  rejectMediaPlanOnCampaignObject,
  requestChangesMediaPlanOnCampaignObject,
} from "@/features/campaign-outputs/media-plan-mutations";
import { requireClientScope } from "@/features/portals/scope";
import {
  logMediaPlanTimelineEvents,
  resolveCampaignHeaderIdForMediaPlan,
} from "@/lib/media-plan/log-media-plan-timeline";
import type { MediaPlanTimelineEvent } from "@/lib/media-plan";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { RequestUser } from "@/lib/supabase/server";

export type ClientMediaPlanActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

const baseSchema = z.object({
  campaignId: z.string().uuid(),
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  notes: z.string().max(4000).optional(),
});

type UserSupabase = RequestUser["supabase"];

async function assertClientCanApproveMediaPlan(
  supabase: UserSupabase,
  userId: string,
  clientId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("client_users")
    .select("access_role")
    .eq("profile_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as { access_role: string } | null)?.access_role === "approve";
}

async function loadPortalScopedObject(input: {
  campaignId: string;
  campaignObjectId: string;
  conversationId: string;
}): Promise<
  | {
      ok: true;
      restored: CampaignObject;
      userSupabase: UserSupabase;
      userId: string;
      contextSnapshot: Record<string, unknown>;
    }
  | { ok: false; message: string }
> {
  try {
    const { supabase, scope } = await requireClientScope("client_portal.approve");

    const { data: header, error: headerError } = await supabase
      .from("campaign_headers")
      .select("id, client_id, campaign_object_id")
      .eq("id", input.campaignId)
      .maybeSingle();

    if (headerError) return { ok: false, message: headerError.message };
    if (!header) return { ok: false, message: "Campaign not found." };

    const typed = header as {
      id: string;
      client_id: string | null;
      campaign_object_id: string | null;
    };

    if (!typed.client_id || !scope.clientIds.includes(typed.client_id)) {
      return { ok: false, message: "You cannot decide on this campaign Media Plan." };
    }

    if (typed.campaign_object_id !== input.campaignObjectId) {
      return { ok: false, message: "Media Plan is not linked to this campaign." };
    }

    const canApprove = await assertClientCanApproveMediaPlan(
      supabase,
      scope.userId,
      typed.client_id
    );
    if (!canApprove) {
      return {
        ok: false,
        message: "Your client access role is view-only. Approvals require an approve role.",
      };
    }

    const { data: conversationRow } = await supabase
      .from("ai_conversations")
      .select("context_snapshot")
      .eq("id", input.conversationId)
      .maybeSingle();

    const contextSnapshot = ((conversationRow as {
      context_snapshot?: Record<string, unknown>;
    } | null)?.context_snapshot ?? {}) as Record<string, unknown>;

    // Prefer user-scoped load (SELECT via campaign header RLS). Admin only for persist.
    let restored = await loadCampaignObjectForConversation(
      supabase,
      input.conversationId,
      contextSnapshot
    );

    if (!restored || restored.id !== input.campaignObjectId) {
      const admin = createSupabaseAdminClient();
      restored = await loadCampaignObjectForConversation(
        admin,
        input.conversationId,
        contextSnapshot
      );
    }

    if (!restored || restored.id !== input.campaignObjectId) {
      return { ok: false, message: "Media Plan could not be loaded." };
    }

    return {
      ok: true,
      restored,
      userSupabase: supabase,
      userId: scope.userId,
      contextSnapshot,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Authorization failed.",
    };
  }
}

async function persistPortalDecision(input: {
  campaignId: string;
  campaignObjectId: string;
  conversationId: string;
  campaignObject: CampaignObject;
  events: MediaPlanTimelineEvent[];
  userId: string;
  contextSnapshot: Record<string, unknown>;
}): Promise<void> {
  // Persist + Timeline use service role after portal authz — clients have SELECT-only RLS.
  const admin = createSupabaseAdminClient();

  const saved = await saveCampaignObject(input.conversationId, input.campaignObject, {
    supabase: admin,
    userId: input.userId,
    persistToDb: true,
    saveReason: "manual",
    campaignHeaderId: input.campaignId,
  });

  try {
    await updateConversationContextSnapshot(
      admin,
      input.conversationId,
      input.userId,
      attachCampaignObjectToSnapshot(input.contextSnapshot, saved)
    );
  } catch {
    /* conversation snapshot is best-effort for portal decisions */
  }

  const headerId = await resolveCampaignHeaderIdForMediaPlan(
    admin,
    input.campaignObjectId,
    input.campaignId
  );
  if (headerId) {
    try {
      await logMediaPlanTimelineEvents(admin, {
        campaignHeaderId: headerId,
        campaignObjectId: input.campaignObjectId,
        actorId: input.userId,
        events: input.events,
      });
    } catch {
      /* timeline must not fail the decision */
    }
  }

  revalidatePath("/client-portal/campaigns");
  revalidatePath(`/client-portal/campaigns/${input.campaignId}/media-plan`);
  revalidatePath("/client-portal/approvals");
}

/** Client Portal: Approve Media Plan → Engine baseline publish + Timeline. */
export async function clientApproveMediaPlanAction(
  input: z.infer<typeof baseSchema>
): Promise<ClientMediaPlanActionResult> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadPortalScopedObject(parsed.data);
  if (!loaded.ok) return loaded;

  const result = approveMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
    method: "client_portal",
    notes: parsed.data.notes,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not approve Media Plan." : result.message };
  }

  await persistPortalDecision({
    campaignId: parsed.data.campaignId,
    campaignObjectId: parsed.data.campaignObjectId,
    conversationId: parsed.data.conversationId,
    campaignObject: result.campaignObject,
    events: result.events,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });

  return { ok: true, message: result.change };
}

/** Client Portal: Request Changes → Engine draft fork + Timeline. */
export async function clientRequestMediaPlanChangesAction(
  input: z.infer<typeof baseSchema>
): Promise<ClientMediaPlanActionResult> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadPortalScopedObject(parsed.data);
  if (!loaded.ok) return loaded;

  const result = requestChangesMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
    notes: parsed.data.notes,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not request changes." : result.message };
  }

  await persistPortalDecision({
    campaignId: parsed.data.campaignId,
    campaignObjectId: parsed.data.campaignObjectId,
    conversationId: parsed.data.conversationId,
    campaignObject: result.campaignObject,
    events: result.events,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });

  return { ok: true, message: result.change };
}

/** Client Portal: Reject locked Media Plan → Engine draft + Timeline. */
export async function clientRejectMediaPlanAction(
  input: z.infer<typeof baseSchema>
): Promise<ClientMediaPlanActionResult> {
  const parsed = baseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };

  const loaded = await loadPortalScopedObject(parsed.data);
  if (!loaded.ok) return loaded;

  const result = rejectMediaPlanOnCampaignObject(loaded.restored, {
    actorUserId: loaded.userId,
    notes: parsed.data.notes,
  });
  if (!result.ok || !result.change) {
    return { ok: false, message: result.ok ? "Could not reject Media Plan." : result.message };
  }

  await persistPortalDecision({
    campaignId: parsed.data.campaignId,
    campaignObjectId: parsed.data.campaignObjectId,
    conversationId: parsed.data.conversationId,
    campaignObject: result.campaignObject,
    events: result.events,
    userId: loaded.userId,
    contextSnapshot: loaded.contextSnapshot,
  });

  return { ok: true, message: result.change };
}
