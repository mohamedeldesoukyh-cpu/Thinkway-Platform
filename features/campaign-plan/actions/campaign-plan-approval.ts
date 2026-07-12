"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  deserializeCampaignObject,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import {
  canTransitionLifecycle,
  lifecycleLabel,
} from "@/features/campaign-intelligence/services/campaign-lifecycle";
import type { CampaignObjectLifecycleStatus } from "@/features/campaign-intelligence/types/campaign-lifecycle";
import { resolvePresentationCompletion } from "@/features/campaign-studio/services/section-data-resolver";
import { requirePermission } from "@/lib/auth/permissions-server";
import {
  deriveCampaignPlanApprovalFlags,
  isCampaignPlanLockedForEdits,
  mapLifecycleToPresentationStatus,
} from "@/lib/domains/commercial/campaign-plan-approval";
import {
  approveCampaignPlan,
  requestCampaignPlanChanges,
  submitCampaignPlanForReview,
} from "@/lib/services/campaign-plan/approve-campaign-plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const approvalActionSchema = z.object({
  campaignObjectId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  campaignObject: z.record(z.string(), z.unknown()),
});

const requestChangesSchema = approvalActionSchema.extend({
  message: z.string().trim().max(2000).optional(),
});

export type CampaignPlanApprovalContext = {
  lifecycleStatus: CampaignObjectLifecycleStatus;
  lifecycleLabel: string;
  presentationStatus: ReturnType<typeof mapLifecycleToPresentationStatus>;
  canApprove: boolean;
  canSubmitForReview: boolean;
  canRequestChanges: boolean;
  canGenerate: boolean;
  completionPercent: number;
  currentVersion: number;
};

export type CampaignPlanApprovalActionResult =
  | {
      ok: true;
      lifecycleStatus: CampaignObjectLifecycleStatus;
      message: string;
    }
  | { ok: false; message: string };

function parseCampaignObject(value: Record<string, unknown>): CampaignObject | null {
  try {
    return deserializeCampaignObject(
      value as Parameters<typeof deserializeCampaignObject>[0]
    );
  } catch {
    return null;
  }
}

export async function getCampaignPlanApprovalContext(input: {
  campaignObjectId: string;
  conversationId?: string;
  campaignObject?: CampaignObject;
}): Promise<CampaignPlanApprovalContext | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) return { error: auth.error };

  const { data: head, error } = await supabase
    .from("campaign_objects")
    .select("id, lifecycle_status, current_version")
    .eq("id", input.campaignObjectId)
    .maybeSingle();

  if (error) return { error: error.message };
  if (!head) return { error: "Campaign Plan not found." };

  const lifecycleStatus = head.lifecycle_status as CampaignObjectLifecycleStatus;
  const completionPercent = input.campaignObject
    ? resolvePresentationCompletion(input.campaignObject).completionPercent
    : 0;

  const flags = deriveCampaignPlanApprovalFlags({
    lifecycleStatus,
    completionPercent,
  });

  const [canApprove, canSubmitForReview, canRequestChanges] = await Promise.all([
    flags.canApprove
      ? canTransitionLifecycle(supabase, auth.roleSlug, lifecycleStatus, "approved")
      : Promise.resolve(false),
    flags.canSubmitForReview
      ? canTransitionLifecycle(supabase, auth.roleSlug, lifecycleStatus, "in_review")
      : Promise.resolve(false),
    flags.canRequestChanges
      ? canTransitionLifecycle(supabase, auth.roleSlug, lifecycleStatus, "draft")
      : Promise.resolve(false),
  ]);

  return {
    lifecycleStatus,
    lifecycleLabel: lifecycleLabel(lifecycleStatus),
    presentationStatus: mapLifecycleToPresentationStatus(lifecycleStatus),
    canApprove,
    canSubmitForReview,
    canRequestChanges,
    canGenerate: flags.canGenerate,
    completionPercent,
    currentVersion: head.current_version,
  };
}

export async function submitCampaignPlanForReviewAction(
  input: z.infer<typeof approvalActionSchema>
): Promise<CampaignPlanApprovalActionResult> {
  const parsed = approvalActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid input for review submission." };
  }

  const campaignObject = parseCampaignObject(parsed.data.campaignObject);
  if (!campaignObject) {
    return { ok: false, message: "Campaign Plan data is invalid." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.write");
  if ("error" in auth) {
    return { ok: false, message: auth.error };
  }

  const result = await submitCampaignPlanForReview(
    supabase,
    auth.userId,
    auth.roleSlug,
    {
      campaignObjectId: parsed.data.campaignObjectId,
      campaignObject,
      conversationId: parsed.data.conversationId,
    }
  );

  if (!result.ok) return result;

  if (parsed.data.conversationId) {
    revalidatePath(`/ai/${parsed.data.conversationId}`);
  }

  return {
    ok: true,
    lifecycleStatus: result.lifecycleStatus,
    message: `Campaign Plan submitted for director review (v${result.version}).`,
  };
}

export async function approveCampaignPlanAction(
  input: z.infer<typeof approvalActionSchema>
): Promise<CampaignPlanApprovalActionResult> {
  const parsed = approvalActionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid input for approval." };
  }

  const campaignObject = parseCampaignObject(parsed.data.campaignObject);
  if (!campaignObject) {
    return { ok: false, message: "Campaign Plan data is invalid." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "approvals.write");
  if ("error" in auth) {
    const fallback = await requirePermission(supabase, "ai.write");
    if ("error" in fallback) {
      return { ok: false, message: "You need approval permissions to sign off Campaign Plans." };
    }
    return runApprove(supabase, fallback.userId, fallback.roleSlug, parsed.data, campaignObject);
  }

  return runApprove(supabase, auth.userId, auth.roleSlug, parsed.data, campaignObject);
}

async function runApprove(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  roleSlug: string | null,
  data: z.infer<typeof approvalActionSchema>,
  campaignObject: CampaignObject
): Promise<CampaignPlanApprovalActionResult> {
  const result = await approveCampaignPlan(supabase, userId, roleSlug, {
    campaignObjectId: data.campaignObjectId,
    campaignObject,
    conversationId: data.conversationId,
  });

  if (!result.ok) return result;

  if (data.conversationId) {
    revalidatePath(`/ai/${data.conversationId}`);
  }

  return {
    ok: true,
    lifecycleStatus: result.lifecycleStatus,
    message: `Campaign Plan approved (v${result.version}). You can now generate a quotation or execution campaign.`,
  };
}

export async function requestCampaignPlanChangesAction(
  input: z.infer<typeof requestChangesSchema>
): Promise<CampaignPlanApprovalActionResult> {
  const parsed = requestChangesSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid input for change request." };
  }

  const campaignObject = parseCampaignObject(parsed.data.campaignObject);
  if (!campaignObject) {
    return { ok: false, message: "Campaign Plan data is invalid." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "approvals.write");
  if ("error" in auth) {
    const fallback = await requirePermission(supabase, "ai.write");
    if ("error" in fallback) {
      return {
        ok: false,
        message: "You need approval permissions to request Campaign Plan changes.",
      };
    }
    return runRequestChanges(
      supabase,
      fallback.userId,
      fallback.roleSlug,
      parsed.data,
      campaignObject
    );
  }

  return runRequestChanges(supabase, auth.userId, auth.roleSlug, parsed.data, campaignObject);
}

async function runRequestChanges(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  roleSlug: string | null,
  data: z.infer<typeof requestChangesSchema>,
  campaignObject: CampaignObject
): Promise<CampaignPlanApprovalActionResult> {
  const result = await requestCampaignPlanChanges(supabase, userId, roleSlug, {
    campaignObjectId: data.campaignObjectId,
    campaignObject,
    conversationId: data.conversationId,
    message: data.message,
  });

  if (!result.ok) return result;

  if (data.conversationId) {
    revalidatePath(`/ai/${data.conversationId}`);
  }

  return {
    ok: true,
    lifecycleStatus: result.lifecycleStatus,
    message: "Campaign Plan returned to draft for revisions.",
  };
}

export async function getCampaignPlanLifecycleStatus(
  campaignObjectId: string
): Promise<CampaignObjectLifecycleStatus | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("campaign_objects")
    .select("lifecycle_status")
    .eq("id", campaignObjectId)
    .maybeSingle();

  return (data?.lifecycle_status as CampaignObjectLifecycleStatus | undefined) ?? null;
}

export async function assertCampaignPlanEditableForOutput(
  campaignObjectId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const lifecycle = await getCampaignPlanLifecycleStatus(campaignObjectId);
  if (isCampaignPlanLockedForEdits(lifecycle)) {
    return {
      ok: false,
      message:
        "Request changes to edit an approved Campaign Plan before regenerating outputs.",
    };
  }
  return { ok: true };
}
