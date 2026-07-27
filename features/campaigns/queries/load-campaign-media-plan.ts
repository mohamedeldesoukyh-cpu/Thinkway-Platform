import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";
import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import { getMediaPlanLifecycle } from "@/features/campaign-outputs/media-plan-mutations";
import { getOutputContentForDisplay } from "@/features/campaign-outputs/output-registry";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import { emptyMediaPlanData, mediaPlanDataToItems, itemsToMediaPlanData } from "@/lib/media-plan/calendar-adapter";
import { mediaPlanStateFromCampaignObject } from "@/lib/media-plan/campaign-object-state";
import { performanceFactsFromAssignmentHierarchy } from "@/lib/media-plan/performance-facts";
import { mediaPlanEngine } from "@/lib/media-plan";
import type { MediaPlanStatus, MediaPlanViewKind } from "@/lib/media-plan";
import type { Database } from "@/types/database";

export type CampaignMediaPlanWorkspacePayload = {
  campaignId: string;
  campaignName: string;
  documentNumber: string | null;
  campaignObjectId: string | null;
  conversationId: string | null;
  status: MediaPlanStatus;
  versionLabel: string;
  canEditOriginal: boolean;
  campaignStartDate: string;
  durationWeeks: number;
  views: Record<MediaPlanViewKind, MediaPlanData>;
  unscheduledRemainingCount: number;
  hasApprovedBaseline: boolean;
  emptyReason: string | null;
};

function resolveOriginalData(campaignObject: CampaignObject): MediaPlanData {
  const content = getOutputContentForDisplay(campaignObject, "media_plan");
  if (content?.data) {
    return content.data as unknown as MediaPlanData;
  }
  try {
    const generated = generateMediaPlan(campaignObject);
    if (generated.data) {
      return generated.data as unknown as MediaPlanData;
    }
  } catch {
    /* fall through */
  }
  return emptyMediaPlanData(new Date().toISOString().slice(0, 10), 4);
}

/**
 * Calendar data for the Current Approved Baseline — never the Working Draft tip.
 * Used as the item source for Actual / Remaining Engine projections.
 */
function resolveApprovedBaselineData(
  campaignObject: CampaignObject,
  tipData: MediaPlanData
): MediaPlanData {
  const lifecycle = getMediaPlanLifecycle(campaignObject);
  if (lifecycle.currentApprovedBaselineVersion == null) {
    return tipData;
  }
  // Tip equals baseline when there is no active draft.
  if (lifecycle.workingDraftVersion == null) {
    return tipData;
  }
  const snap =
    lifecycle.approvedScheduleSnapshots[
      String(lifecycle.currentApprovedBaselineVersion)
    ];
  if (!snap || typeof snap !== "object") {
    return tipData;
  }
  const baselineObject: CampaignObject = {
    ...campaignObject,
    meta: {
      ...campaignObject.meta,
      mediaPlanSchedule: snap as CampaignObject["meta"]["mediaPlanSchedule"],
    },
  };
  try {
    const generated = generateMediaPlan(baselineObject);
    if (generated.data) {
      return generated.data as unknown as MediaPlanData;
    }
  } catch {
    /* fall through */
  }
  return tipData;
}

export async function loadCampaignMediaPlanWorkspace(
  supabase: SupabaseClient<Database>,
  workspace: CampaignWorkspace
): Promise<CampaignMediaPlanWorkspacePayload> {
  const campaignObjectId = workspace.campaign_object_id?.trim() || null;

  if (!campaignObjectId) {
    const start = new Date().toISOString().slice(0, 10);
    const empty = emptyMediaPlanData(start, 4);
    return {
      campaignId: workspace.id,
      campaignName: workspace.name,
      documentNumber: workspace.document_number ?? null,
      campaignObjectId: null,
      conversationId: null,
      status: "draft",
      versionLabel: "No Media Plan",
      canEditOriginal: false,
      campaignStartDate: start,
      durationWeeks: 4,
      views: { original: empty, actual: empty, remaining: empty },
      unscheduledRemainingCount: 0,
      hasApprovedBaseline: false,
      emptyReason:
        "No Studio Media Plan is linked to this campaign yet. Open Studio to attach or generate one — Campaign and Studio share the same Media Plan.",
    };
  }

  const { data: head, error: headError } = await supabase
    .from("campaign_objects")
    .select("id, conversation_id, current_version")
    .eq("id", campaignObjectId)
    .maybeSingle();

  if (headError || !head) {
    const start = new Date().toISOString().slice(0, 10);
    const empty = emptyMediaPlanData(start, 4);
    return {
      campaignId: workspace.id,
      campaignName: workspace.name,
      documentNumber: workspace.document_number ?? null,
      campaignObjectId,
      conversationId: null,
      status: "draft",
      versionLabel: "Unavailable",
      canEditOriginal: false,
      campaignStartDate: start,
      durationWeeks: 4,
      views: { original: empty, actual: empty, remaining: empty },
      unscheduledRemainingCount: 0,
      hasApprovedBaseline: false,
      emptyReason: "The linked Media Plan could not be loaded.",
    };
  }

  const typedHead = head as {
    id: string;
    conversation_id: string | null;
    current_version: number;
  };

  let campaignObject: CampaignObject | null = null;
  if (typedHead.current_version > 0) {
    const version = await CampaignObjectPersistenceService.loadVersion(
      supabase,
      campaignObjectId,
      typedHead.current_version
    );
    campaignObject = version?.campaignObject ?? null;
  }
  if (!campaignObject && typedHead.conversation_id) {
    campaignObject = await CampaignObjectPersistenceService.restoreForConversation(
      supabase,
      typedHead.conversation_id
    );
  }

  if (!campaignObject) {
    const start = new Date().toISOString().slice(0, 10);
    const empty = emptyMediaPlanData(start, 4);
    return {
      campaignId: workspace.id,
      campaignName: workspace.name,
      documentNumber: workspace.document_number ?? null,
      campaignObjectId,
      conversationId: typedHead.conversation_id,
      status: "draft",
      versionLabel: "Empty",
      canEditOriginal: false,
      campaignStartDate: start,
      durationWeeks: 4,
      views: { original: empty, actual: empty, remaining: empty },
      unscheduledRemainingCount: 0,
      hasApprovedBaseline: false,
      emptyReason: "The Media Plan has no saved version yet. Open Studio to generate it.",
    };
  }

  const original = resolveOriginalData(campaignObject);
  const baselineData = resolveApprovedBaselineData(campaignObject, original);
  const lifecycle = getMediaPlanLifecycle(campaignObject);
  const state = mediaPlanStateFromCampaignObject(campaignObject, baselineData, {
    campaignId: workspace.id,
    tipData: original,
  });

  const hierarchy = await getCampaignAssignmentHierarchy(workspace.id);
  const performance = performanceFactsFromAssignmentHierarchy(hierarchy);
  const execution = mediaPlanEngine.projectExecutionViews(state, performance);

  const start = original.campaignStartDate;
  const durationWeeks = original.durationWeeks || original.calendarWeeks || 4;

  const actual =
    execution.baselineVersion != null
      ? itemsToMediaPlanData(execution.actual.items, {
          campaignStartDate: start,
          durationWeeks,
          viewKind: "actual",
          dateField: "actualLiveDate",
        })
      : emptyMediaPlanData(start, durationWeeks);

  const remaining =
    execution.baselineVersion != null
      ? itemsToMediaPlanData(execution.remaining.items, {
          campaignStartDate: start,
          durationWeeks,
          viewKind: "remaining",
          dateField: "plannedDate",
        })
      : emptyMediaPlanData(start, durationWeeks);

  const versionNumber =
    lifecycle.workingDraftVersion ?? lifecycle.currentApprovedBaselineVersion ?? 1;

  return {
    campaignId: workspace.id,
    campaignName: workspace.name,
    documentNumber: workspace.document_number ?? null,
    campaignObjectId,
    conversationId: typedHead.conversation_id,
    status: lifecycle.status,
    versionLabel: `Version ${versionNumber}`,
    canEditOriginal: lifecycle.status === "draft",
    campaignStartDate: start,
    durationWeeks,
    views: {
      original,
      actual,
      remaining,
    },
    unscheduledRemainingCount: execution.remaining.unscheduled?.length ?? 0,
    hasApprovedBaseline: execution.baselineVersion != null,
    emptyReason: null,
  };
}

/** Re-export for tests — tip item extraction. */
export function originalItemsFromData(data: MediaPlanData) {
  return mediaPlanDataToItems(data);
}
