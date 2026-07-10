import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";

import type { CampaignStudioSectionId } from "../types/campaign-studio";

/** Creator ids appear both raw and "inf:"-prefixed across sections — compare normalized. */
export function normalizeCreatorId(id: string): string {
  return id.trim().replace(/^inf:/, "");
}

function sameCreator(a: string, b: string): boolean {
  return normalizeCreatorId(a) === normalizeCreatorId(b);
}

export function getStudioDraft(campaignObject: CampaignObject | undefined): StudioDraftState {
  const creatorsData = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  return creatorsData.studioDraft ?? { changes: [], updatedAt: "" };
}

/**
 * Stage a change into the draft. One pending change per creator (last wins);
 * opposite operations cancel out instead of stacking:
 * removing a draft-added creator drops the add, re-staging anything on a
 * removed creator replaces the removal.
 */
export function stageDraftChange(
  draft: StudioDraftState,
  change: StudioDraftChange
): StudioDraftState {
  const changeCreatorId =
    change.kind === "add_creator" ? change.creator.creatorId : change.creatorId;

  const remaining = draft.changes.filter((existing) => {
    const existingCreatorId =
      existing.kind === "add_creator" ? existing.creator.creatorId : existing.creatorId;
    return !sameCreator(existingCreatorId, changeCreatorId);
  });

  const dropped = draft.changes.length - remaining.length;
  const cancelledAdd =
    change.kind === "remove_creator" &&
    dropped > 0 &&
    draft.changes.some(
      (existing) =>
        existing.kind === "add_creator" &&
        sameCreator(existing.creator.creatorId, changeCreatorId)
    );

  return {
    // Removing a creator that only existed as a draft add cancels the add entirely.
    changes: cancelledAdd ? remaining : [...remaining, change],
    updatedAt: new Date().toISOString(),
  };
}

/** Undo a single staged change by the creator it targets. */
export function unstageDraftChange(
  draft: StudioDraftState,
  creatorId: string
): StudioDraftState {
  return {
    changes: draft.changes.filter((existing) => {
      const existingCreatorId =
        existing.kind === "add_creator" ? existing.creator.creatorId : existing.creatorId;
      return !sameCreator(existingCreatorId, creatorId);
    }),
    updatedAt: new Date().toISOString(),
  };
}

/** Pending change targeting a creator, if any — drives per-card indicators. */
export function draftChangeForCreator(
  draft: StudioDraftState,
  creatorId: string | undefined
): StudioDraftChange | undefined {
  if (!creatorId) return undefined;
  return draft.changes.find((change) => {
    const target = change.kind === "add_creator" ? change.creator.creatorId : change.creatorId;
    return sameCreator(target, creatorId);
  });
}

/**
 * Dependency graph: which sections a staged change invalidates. Sections are
 * only marked outdated — recomputation happens once, on Apply All Updates.
 */
const SLATE_DEPENDENT_SECTIONS: CampaignStudioSectionId[] = [
  "creator-recommendations",
  "creator-mix",
  "budget-planner",
  "timeline",
  "kpi-forecast",
  "content-plan",
  "creative-concepts",
  "success-probability",
  "executive-summary",
];

const REFRESH_DEPENDENT_SECTIONS: CampaignStudioSectionId[] = [
  "creator-recommendations",
  "kpi-forecast",
  "success-probability",
];

export function outdatedSectionsForDraft(
  draft: StudioDraftState
): Set<CampaignStudioSectionId> {
  const outdated = new Set<CampaignStudioSectionId>();
  for (const change of draft.changes) {
    const affected =
      change.kind === "refresh_intelligence"
        ? REFRESH_DEPENDENT_SECTIONS
        : SLATE_DEPENDENT_SECTIONS;
    for (const sectionId of affected) outdated.add(sectionId);
  }
  return outdated;
}

/** Patch the campaign object with a new draft state (no recalculation). */
export function withStudioDraft(
  campaignObject: CampaignObject,
  draft: StudioDraftState
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const nextData: CreatorsSectionData = { ...creatorsData, studioDraft: draft };
  if (draft.changes.length === 0) {
    delete nextData.studioDraft;
  }

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: { ...campaignObject.sections.creators, data: nextData },
    },
    updatedAt: new Date().toISOString(),
  };
}

export type ApplyStudioDraftResult = {
  campaignObject: CampaignObject;
  removedCreatorIds: string[];
  /** Changes the apply engine does not handle yet — kept staged. */
  unappliedChanges: StudioDraftChange[];
};

/**
 * Apply staged removals to the recommendation slate in one operation:
 * filter creator ids, reasoning, and fit scores, then clear applied changes.
 * Dependent sections derive from the slate at render/export time, so they
 * refresh automatically once the slate updates.
 */
export function applyStudioDraftRemovals(campaignObject: CampaignObject): ApplyStudioDraftResult {
  const draft = getStudioDraft(campaignObject);
  const removals = draft.changes.filter((c) => c.kind === "remove_creator");
  const unappliedChanges = draft.changes.filter((c) => c.kind !== "remove_creator");

  if (removals.length === 0) {
    return { campaignObject, removedCreatorIds: [], unappliedChanges };
  }

  const removedIds = new Set(removals.map((c) => normalizeCreatorId(c.creatorId)));
  const keep = (id: string) => !removedIds.has(normalizeCreatorId(id));

  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const recommendations = creatorsData.recommendations;

  const nextRecommendations = recommendations
    ? {
        ...recommendations,
        creatorIds: (recommendations.creatorIds ?? []).filter(keep),
        selectedReasoning: recommendations.selectedReasoning?.filter((r) =>
          keep(r.creatorId)
        ),
        creatorFitScores: recommendations.creatorFitScores
          ? Object.fromEntries(
              Object.entries(recommendations.creatorFitScores).filter(([id]) => keep(id))
            )
          : undefined,
      }
    : recommendations;

  const nextData: CreatorsSectionData = {
    ...creatorsData,
    ...(nextRecommendations ? { recommendations: nextRecommendations } : {}),
  };
  if (unappliedChanges.length === 0) {
    delete nextData.studioDraft;
  } else {
    nextData.studioDraft = { changes: unappliedChanges, updatedAt: new Date().toISOString() };
  }

  return {
    campaignObject: {
      ...campaignObject,
      sections: {
        ...campaignObject.sections,
        creators: { ...campaignObject.sections.creators, data: nextData },
      },
      updatedAt: new Date().toISOString(),
    },
    removedCreatorIds: removals.map((c) => c.creatorId),
    unappliedChanges,
  };
}
