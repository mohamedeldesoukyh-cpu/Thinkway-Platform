import { MEDIA_PLAN_ENGINE_VERSION } from "./config";
import { compareMediaPlanVersions } from "./compare";
import { assertSourceCanMutateMediaPlanSchedule } from "./ownership";
import {
  projectActualMediaPlan,
  projectOriginalWorkingView,
  projectRemainingMediaPlan,
} from "./projections";
import {
  getRegenerateUiStateForPlan,
  prepareRegenerate,
  recordDraftRegenerated,
} from "./regenerate-policy";
import { mediaPlanStatusLabel } from "./status";
import { mediaPlanEventsForCampaignTimeline } from "./timeline-events";
import type { MediaPlanMutationSource } from "./ownership";
import type { MediaPlanItem, MediaPlanPerformanceFact, MediaPlanState } from "./types";
import {
  assertCanMutateWorkingVersion,
  createInitialMediaPlanState,
  ensureWorkingDraft,
  getCurrentApprovedBaseline,
  getWorkingDraft,
  lockWorkingDraft,
  promoteWorkingDraftToBaseline,
  replaceWorkingDraftItems,
  validateMediaPlanState,
} from "./versioning";

export type { MediaPlanMutationSource } from "./ownership";

/**
 * Media Plan Engine — central platform capability.
 *
 * Studio, Campaign, Client Portal, Performance, and Reporting must consume
 * this engine. Modules must not implement independent Media Plan business logic.
 */
export const mediaPlanEngine = {
  version: MEDIA_PLAN_ENGINE_VERSION,

  createInitial: createInitialMediaPlanState,
  validate: validateMediaPlanState,
  statusLabel: mediaPlanStatusLabel,

  getBaseline: getCurrentApprovedBaseline,
  getDraft: getWorkingDraft,
  getOriginalView: projectOriginalWorkingView,

  ensureWorkingDraft,
  lockWorkingDraft,
  promoteWorkingDraftToBaseline,
  replaceWorkingDraftItems,
  assertCanMutateWorkingVersion,

  getRegenerateUiState: getRegenerateUiStateForPlan,
  prepareRegenerate,
  recordDraftRegenerated,

  projectActual: projectActualMediaPlan,
  projectRemaining: projectRemainingMediaPlan,

  compare: compareMediaPlanVersions,
  timelineEvents: mediaPlanEventsForCampaignTimeline,

  assertMutationSource: assertSourceCanMutateMediaPlanSchedule,

  /**
   * Guarded schedule write — rejects output generators and non-draft tips.
   */
  applyScheduleItems(
    state: MediaPlanState,
    items: MediaPlanItem[],
    input: {
      at: string;
      actorUserId?: string | null;
      source: MediaPlanMutationSource;
    }
  ) {
    const ownership = assertSourceCanMutateMediaPlanSchedule(input.source);
    if (!ownership.ok) return ownership;

    return replaceWorkingDraftItems(state, items, {
      at: input.at,
      actorUserId: input.actorUserId,
    });
  },

  /**
   * Actual + Remaining always use Current Approved Baseline (+ performance).
   * Draft edits do not affect these projections until promotion.
   */
  projectExecutionViews(
    state: MediaPlanState,
    performance: MediaPlanPerformanceFact[]
  ) {
    return {
      actual: projectActualMediaPlan(state, performance),
      remaining: projectRemainingMediaPlan(state, performance),
      baselineVersion: state.currentApprovedBaselineVersion,
      workingDraftVersion: state.workingDraftVersion,
    };
  },
} as const;
