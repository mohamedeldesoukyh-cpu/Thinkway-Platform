import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  attachCampaignObjectToSnapshot,
  serializeCampaignObject,
  type CampaignObject,
} from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import {
  canTransitionLifecycle,
  isValidLifecycleTransition,
} from "@/features/campaign-intelligence/services/campaign-lifecycle";
import type { CampaignObjectLifecycleStatus } from "@/features/campaign-intelligence/types/campaign-lifecycle";
import {
  isPresentationStatusSectionData,
  type PresentationStatusSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import {
  getConversationWithMessages,
  updateConversationContextSnapshot,
  updateMessageMetadata,
} from "@/features/ai-workspace/services/conversation-service";
import {
  canApproveCampaignPlan,
  canRequestCampaignPlanChanges,
  canSubmitCampaignPlanForReview,
  mapLifecycleToPresentationStatus,
} from "@/lib/domains/commercial/campaign-plan-approval";
import {
  evaluateCampaignPlanReadiness,
  formatCampaignPlanReadinessBlockers,
} from "@/lib/domains/commercial/campaign-plan-readiness";
import type { Database } from "@/types/database";

export type CampaignPlanApprovalResult =
  | {
      ok: true;
      lifecycleStatus: CampaignObjectLifecycleStatus;
      campaignObject: CampaignObject;
      version: number;
    }
  | { ok: false; message: string };

type CampaignPlanApprovalBaseInput = {
  campaignObjectId: string;
  campaignObject: CampaignObject;
  conversationId?: string;
};

async function loadHeadRecord(
  supabase: SupabaseClient<Database>,
  campaignObjectId: string
) {
  const { data: head, error } = await supabase
    .from("campaign_objects")
    .select("id, lifecycle_status, conversation_id")
    .eq("id", campaignObjectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!head) return null;
  return head as {
    id: string;
    lifecycle_status: CampaignObjectLifecycleStatus;
    conversation_id: string;
  };
}

function applyPresentationStatus(
  campaignObject: CampaignObject,
  status: PresentationStatusSectionData["status"]
): CampaignObject {
  const presentation = campaignObject.sections.presentation;
  const stored = isPresentationStatusSectionData(presentation.content)
    ? presentation.content
    : {
        status: "draft" as const,
        message: "Campaign draft prepared for approval.",
      };

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      presentation: {
        ...presentation,
        content: {
          ...stored,
          status,
          nextStep:
            status === "awaiting_approval"
              ? "Awaiting Campaign Director review."
              : status === "approved"
                ? "Campaign Plan approved — generate quotation or execution campaign."
                : stored.nextStep,
        },
        status: status === "approved" ? "complete" : presentation.status,
      },
    },
  };
}

function validateSubmitReadiness(
  campaignObject: CampaignObject
): { ok: true } | { ok: false; message: string } {
  const readiness = evaluateCampaignPlanReadiness(campaignObject);

  if (!canSubmitCampaignPlanForReview("draft", readiness)) {
    return {
      ok: false,
      message:
        formatCampaignPlanReadinessBlockers(readiness) ||
        "Campaign Plan is not ready for director review.",
    };
  }

  return { ok: true };
}

async function persistCampaignObjectToConversation(
  supabase: SupabaseClient<Database>,
  userId: string,
  conversationId: string,
  campaignObject: CampaignObject
): Promise<void> {
  const conversation = await getConversationWithMessages(supabase, conversationId, userId);
  if (!conversation?.messages?.length) return;

  const studioMessage = [...conversation.messages]
    .reverse()
    .find((message) => message.metadata?.campaignObject);

  const serialized = serializeCampaignObject(campaignObject);

  if (studioMessage) {
    await updateMessageMetadata(supabase, studioMessage.id, {
      ...studioMessage.metadata,
      campaignObject: serialized,
    });
  }

  try {
    await updateConversationContextSnapshot(
      supabase,
      conversationId,
      userId,
      attachCampaignObjectToSnapshot({}, campaignObject)
    );
  } catch {
    // Non-fatal — message metadata already carries the object.
  }

  revalidatePath(`/ai/${conversationId}`);
}

async function saveAndTransition(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    roleSlug: string | null;
    campaignObjectId: string;
    campaignObject: CampaignObject;
    conversationId?: string;
    toStatus: CampaignObjectLifecycleStatus;
    saveReason: "review_submitted" | "approved" | "manual";
    presentationStatus: PresentationStatusSectionData["status"];
  }
): Promise<CampaignPlanApprovalResult> {
  const head = await loadHeadRecord(supabase, input.campaignObjectId);
  if (!head) {
    return { ok: false, message: "Campaign Plan not found." };
  }

  const fromStatus = head.lifecycle_status;
  if (!isValidLifecycleTransition(fromStatus, input.toStatus)) {
    return {
      ok: false,
      message: `Cannot move Campaign Plan from ${fromStatus.replaceAll("_", " ")} to ${input.toStatus.replaceAll("_", " ")}.`,
    };
  }

  const allowed = await canTransitionLifecycle(
    supabase,
    input.roleSlug,
    fromStatus,
    input.toStatus
  );
  if (!allowed) {
    return {
      ok: false,
      message: "You do not have permission to change this Campaign Plan status.",
    };
  }

  const conversationId = input.conversationId ?? head.conversation_id;
  const patched = applyPresentationStatus(input.campaignObject, input.presentationStatus);

  const saved = await CampaignObjectPersistenceService.saveVersion(supabase, {
    campaignObject: patched,
    conversationId,
    userId: input.userId,
    saveReason: input.saveReason,
  });

  const record = await CampaignObjectPersistenceService.transitionLifecycle(supabase, {
    campaignObjectId: input.campaignObjectId,
    toStatus: input.toStatus,
    userId: input.userId,
    roleSlug: input.roleSlug,
  });

  if (input.conversationId) {
    await persistCampaignObjectToConversation(
      supabase,
      input.userId,
      input.conversationId,
      patched
    );
  }

  return {
    ok: true,
    lifecycleStatus: record.lifecycleStatus,
    campaignObject: patched,
    version: saved.version,
  };
}

export async function submitCampaignPlanForReview(
  supabase: SupabaseClient<Database>,
  userId: string,
  roleSlug: string | null,
  input: CampaignPlanApprovalBaseInput
): Promise<CampaignPlanApprovalResult> {
  const head = await loadHeadRecord(supabase, input.campaignObjectId);
  if (!head) {
    return { ok: false, message: "Campaign Plan not found." };
  }

  if (head.lifecycle_status !== "draft") {
    return {
      ok: false,
      message: "Only draft Campaign Plans can be submitted for review.",
    };
  }

  const readiness = validateSubmitReadiness(input.campaignObject);
  if (!readiness.ok) return readiness;

  return saveAndTransition(supabase, {
    userId,
    roleSlug,
    campaignObjectId: input.campaignObjectId,
    campaignObject: input.campaignObject,
    conversationId: input.conversationId,
    toStatus: "in_review",
    saveReason: "review_submitted",
    presentationStatus: mapLifecycleToPresentationStatus("in_review"),
  });
}

export async function approveCampaignPlan(
  supabase: SupabaseClient<Database>,
  userId: string,
  roleSlug: string | null,
  input: CampaignPlanApprovalBaseInput
): Promise<CampaignPlanApprovalResult> {
  const head = await loadHeadRecord(supabase, input.campaignObjectId);
  if (!head) {
    return { ok: false, message: "Campaign Plan not found." };
  }

  if (!canApproveCampaignPlan(head.lifecycle_status)) {
    return {
      ok: false,
      message: "Only Campaign Plans in review can be approved.",
    };
  }

  return saveAndTransition(supabase, {
    userId,
    roleSlug,
    campaignObjectId: input.campaignObjectId,
    campaignObject: input.campaignObject,
    conversationId: input.conversationId,
    toStatus: "approved",
    saveReason: "approved",
    presentationStatus: mapLifecycleToPresentationStatus("approved"),
  });
}

export async function requestCampaignPlanChanges(
  supabase: SupabaseClient<Database>,
  userId: string,
  roleSlug: string | null,
  input: CampaignPlanApprovalBaseInput & { message?: string }
): Promise<CampaignPlanApprovalResult> {
  const head = await loadHeadRecord(supabase, input.campaignObjectId);
  if (!head) {
    return { ok: false, message: "Campaign Plan not found." };
  }

  if (!canRequestCampaignPlanChanges(head.lifecycle_status)) {
    return {
      ok: false,
      message: "This Campaign Plan cannot be sent back for changes.",
    };
  }

  const patched = applyPresentationStatus(input.campaignObject, "draft");
  const withMessage =
    input.message?.trim() && isPresentationStatusSectionData(patched.sections.presentation.content)
      ? {
          ...patched,
          sections: {
            ...patched.sections,
            presentation: {
              ...patched.sections.presentation,
              content: {
                ...patched.sections.presentation.content,
                message: input.message.trim(),
                nextStep: "Revise the Campaign Plan and submit for review again.",
              },
            },
          },
        }
      : patched;

  return saveAndTransition(supabase, {
    userId,
    roleSlug,
    campaignObjectId: input.campaignObjectId,
    campaignObject: withMessage,
    conversationId: input.conversationId,
    toStatus: "draft",
    saveReason: "manual",
    presentationStatus: "draft",
  });
}
