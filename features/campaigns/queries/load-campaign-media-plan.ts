import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import {
  generateMediaPlan,
  type MediaPlanData,
} from "@/features/campaign-outputs/generators/media-plan";
import { ensureCreatorsFromAssignmentHierarchy } from "@/features/campaign-outputs/hydration";
import { resolveSlate } from "@/features/campaign-outputs/output-inputs";
import { getMediaPlanLifecycle } from "@/features/campaign-outputs/media-plan-mutations";
import type {
  CampaignOutputVersionSnapshot,
  MediaPlanEditHistoryEntry,
} from "@/features/campaign-outputs/output-types";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { getCampaignAssignmentHierarchy } from "@/features/campaigns/queries/assignment-hierarchy";
import {
  emptyMediaPlanData,
  itemsToMediaPlanData,
  mediaPlanDataToItems,
} from "@/lib/media-plan/calendar-adapter";
import { mediaPlanStateFromCampaignObject } from "@/lib/media-plan/campaign-object-state";
import { annotateMediaPlanExecutionStatus } from "@/lib/media-plan/annotate-execution-status";
import { performanceFactsFromAssignmentHierarchy } from "@/lib/media-plan/performance-facts";
import { stampMediaPlanAssignmentRefsFromSlate } from "@/lib/media-plan/stamp-assignment-refs";
import {
  resolveApprovedBaselineData,
  resolveOriginalData,
} from "@/lib/media-plan/resolve-calendar-data";
import { mediaPlanEngine } from "@/lib/media-plan";
import type {
  MediaPlanDiffEntry,
  MediaPlanItem,
  MediaPlanStatus,
  MediaPlanViewKind,
} from "@/lib/media-plan";
import type { Database } from "@/types/database";
import {
  listCampaignMediaPlans,
  type CampaignMediaPlanListItem,
} from "@/features/campaigns/queries/list-campaign-media-plans";

function actualCalendarWindow(
  items: MediaPlanItem[],
  fallbackStart: string,
  fallbackWeeks: number
): { campaignStartDate: string; durationWeeks: number } {
  const liveDates = items
    .map((item) => item.actualLiveDate)
    .filter((date): date is string => Boolean(date))
    .sort();
  if (!liveDates.length) {
    return { campaignStartDate: fallbackStart, durationWeeks: fallbackWeeks };
  }

  const campaignStartDate = liveDates[0]!;
  const last = liveDates[liveDates.length - 1]!;
  const startMs = new Date(`${campaignStartDate}T00:00:00.000Z`).getTime();
  const lastMs = new Date(`${last}T00:00:00.000Z`).getTime();
  const diffDays = Math.max(0, Math.round((lastMs - startMs) / (24 * 60 * 60 * 1000)));
  const durationWeeks = Math.max(fallbackWeeks, Math.ceil((diffDays + 1) / 7));
  return { campaignStartDate, durationWeeks };
}

export { resolveApprovedBaselineData, resolveOriginalData } from "@/lib/media-plan/resolve-calendar-data";

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
  hasWorkingDraft: boolean;
  baselineVersion: number | null;
  draftVersion: number | null;
  comparisonDiffs: MediaPlanDiffEntry[];
  /** Productivity Edit History (append-only; never bumps business version). */
  editHistory: MediaPlanEditHistoryEntry[];
  /** Business version snapshots (governance). */
  businessVersions: CampaignOutputVersionSnapshot[];
  /** Tip business version label from output registry (e.g. v1.2). */
  tipVersionLabel: string | null;
  emptyReason: string | null;
  /** Release 2.1 — all Media Plans for this Campaign (default first). */
  mediaPlans: CampaignMediaPlanListItem[];
  /** True when the loaded plan is the header default pointer. */
  isDefaultPlan: boolean;
};

export async function loadCampaignMediaPlanWorkspace(
  supabase: SupabaseClient<Database>,
  workspace: CampaignWorkspace,
  options?: { selectedPlanId?: string | null }
): Promise<CampaignMediaPlanWorkspacePayload> {
  const defaultPlanId = workspace.campaign_object_id?.trim() || null;
  const mediaPlans = await listCampaignMediaPlans(supabase, workspace.id, defaultPlanId);
  const requestedPlanId = options?.selectedPlanId?.trim() || null;
  const selectedFromList = requestedPlanId
    ? mediaPlans.find((plan) => plan.campaignObjectId === requestedPlanId)
    : null;
  const campaignObjectId =
    selectedFromList?.campaignObjectId ??
    defaultPlanId ??
    mediaPlans[0]?.campaignObjectId ??
    null;
  const isDefaultPlan = Boolean(
    campaignObjectId && defaultPlanId && campaignObjectId === defaultPlanId
  );

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
      hasWorkingDraft: false,
      baselineVersion: null,
      draftVersion: null,
      comparisonDiffs: [],
      editHistory: [],
      businessVersions: [],
      tipVersionLabel: null,
      emptyReason:
        "No Studio Media Plan is linked to this campaign yet. Open Studio to attach or generate one — Campaign and Studio share the same Media Plan.",
      mediaPlans,
      isDefaultPlan: false,
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
      hasWorkingDraft: false,
      baselineVersion: null,
      draftVersion: null,
      comparisonDiffs: [],
      editHistory: [],
      businessVersions: [],
      tipVersionLabel: null,
      emptyReason: "The linked Media Plan could not be loaded.",
      mediaPlans,
      isDefaultPlan,
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
      hasWorkingDraft: false,
      baselineVersion: null,
      draftVersion: null,
      comparisonDiffs: [],
      editHistory: [],
      businessVersions: [],
      tipVersionLabel: null,
      emptyReason: "The Media Plan has no saved version yet. Open Studio to generate it.",
      mediaPlans,
      isDefaultPlan,
    };
  }

  const hierarchy = await getCampaignAssignmentHierarchy(workspace.id);
  // Campaign vendors feed the slate when Studio never hydrated creators.
  const objectForPlan = ensureCreatorsFromAssignmentHierarchy(campaignObject, hierarchy);
  const slate = resolveSlate(objectForPlan);

  let original = resolveOriginalData(objectForPlan);
  // Cached empty tip wins over slate in resolveOriginalData — rebuild in-memory
  // when Assignments hydrated creators but the saved calendar has none.
  const tipCreatorCount = original.creatorCount ?? 0;
  if (slate.length > 0 && tipCreatorCount === 0) {
    try {
      const generated = generateMediaPlan(objectForPlan);
      if (generated.data) {
        original = generated.data as unknown as MediaPlanData;
      }
    } catch {
      /* keep cached tip */
    }
  }

  // Release 2.1 — ensure calendar cards carry Assignment IDs even for older cached tips.
  original = stampMediaPlanAssignmentRefsFromSlate(original, slate);

  const baselineData = stampMediaPlanAssignmentRefsFromSlate(
    resolveApprovedBaselineData(objectForPlan, original),
    slate
  );
  const lifecycle = getMediaPlanLifecycle(objectForPlan);
  const state = mediaPlanStateFromCampaignObject(objectForPlan, baselineData, {
    campaignId: workspace.id,
    tipData: original,
  });

  const performance = performanceFactsFromAssignmentHierarchy(hierarchy);
  const execution = mediaPlanEngine.projectExecutionViews(state, performance);

  const start = original.campaignStartDate;
  const durationWeeks = original.durationWeeks || original.calendarWeeks || 4;

  // Same Live/Partial/Not-live card colors as Studio — Performance live_date overlay.
  const originalAnnotated = annotateMediaPlanExecutionStatus(original, performance);

  const actualWindow = actualCalendarWindow(execution.actual.items, start, durationWeeks);
  const actual = execution.actual.items.length
    ? annotateMediaPlanExecutionStatus(
        itemsToMediaPlanData(execution.actual.items, {
          campaignStartDate: actualWindow.campaignStartDate,
          durationWeeks: actualWindow.durationWeeks,
          viewKind: "actual",
          dateField: "actualLiveDate",
        }),
        performance
      )
    : emptyMediaPlanData(start, durationWeeks);

  const remaining =
    execution.baselineVersion != null
      ? annotateMediaPlanExecutionStatus(
          itemsToMediaPlanData(execution.remaining.items, {
            campaignStartDate: start,
            durationWeeks,
            viewKind: "remaining",
            dateField: "plannedDate",
          }),
          performance
        )
      : emptyMediaPlanData(start, durationWeeks);

  const baseline = mediaPlanEngine.getBaseline(state);
  const draft = mediaPlanEngine.getDraft(state);
  const comparisonDiffs =
    baseline && draft ? mediaPlanEngine.compare(baseline, draft) : [];

  const versionNumber =
    lifecycle.workingDraftVersion ?? lifecycle.currentApprovedBaselineVersion ?? 1;
  const tipRecord = objectForPlan.meta.campaignOutputs?.media_plan;
  const tipVersionLabel = tipRecord?.versionLabel ?? null;

  return {
    campaignId: workspace.id,
    campaignName: workspace.name,
    documentNumber: workspace.document_number ?? null,
    campaignObjectId,
    conversationId: typedHead.conversation_id,
    status: lifecycle.status,
    versionLabel: tipVersionLabel ?? `Version ${versionNumber}`,
    canEditOriginal: lifecycle.status === "draft",
    campaignStartDate: start,
    durationWeeks,
    views: {
      original: originalAnnotated,
      actual,
      remaining,
    },
    unscheduledRemainingCount: execution.remaining.unscheduled?.length ?? 0,
    hasApprovedBaseline: execution.baselineVersion != null,
    hasWorkingDraft: lifecycle.workingDraftVersion != null,
    baselineVersion: lifecycle.currentApprovedBaselineVersion,
    draftVersion: lifecycle.workingDraftVersion,
    comparisonDiffs,
    editHistory: tipRecord?.editHistory ?? [],
    businessVersions: tipRecord?.history ?? [],
    tipVersionLabel,
    emptyReason: null,
    mediaPlans,
    isDefaultPlan,
  };
}

/** Re-export for tests — tip item extraction. */
export function originalItemsFromData(data: MediaPlanData) {
  return mediaPlanDataToItems(data);
}
