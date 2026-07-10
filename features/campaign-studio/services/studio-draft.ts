import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
  StudioDraftCreatorRef,
  StudioDraftState,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";

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

/** Persist an enrichment-status transition on a staged add_creator change. */
export function updateDraftCreatorEnrichment(
  draft: StudioDraftState,
  creatorId: string,
  enrichmentStatus: NonNullable<StudioDraftCreatorRef["enrichmentStatus"]>
): StudioDraftState {
  return {
    changes: draft.changes.map((change) =>
      change.kind === "add_creator" && sameCreator(change.creator.creatorId, creatorId)
        ? { ...change, creator: { ...change.creator, enrichmentStatus } }
        : change
    ),
    updatedAt: new Date().toISOString(),
  };
}

function reasoningForAddedCreator(ref: StudioDraftCreatorRef): VendorSelectedReasoning {
  const tier = resolveCreatorTierLabel({ followers: ref.followers });
  const sourceLabel =
    ref.source === "external_url" ? "added from a profile link" : "picked from Discovery";
  return {
    creatorId: ref.creatorId,
    displayName: ref.displayName,
    whySelected: `Hand-${ref.source === "external_url" ? "added" : "picked"} by the team (${sourceLabel}) and confirmed on apply.`,
    expectedRole: tier,
    audienceMatch: "Team judgement — validate against the campaign audience.",
    risk: ref.enrichmentStatus === "enriched" ? "Low — profile intelligence refreshed." : "Verify with an intelligence refresh before contracting.",
    alternative: "AI-recommended slate retained alongside this addition.",
    confidence: ref.enrichmentStatus === "enriched" ? 0.75 : 0.6,
    evidence: `Manual Studio addition (${sourceLabel}).`,
    tradeoff: "Manual picks bypass AI ranking until the next re-optimization.",
  };
}

export type ApplyStudioDraftResult = {
  campaignObject: CampaignObject;
  removedCreatorIds: string[];
  addedCreatorIds: string[];
  /** Changes the apply engine does not handle yet — kept staged. */
  unappliedChanges: StudioDraftChange[];
};

/**
 * Apply staged slate edits in one operation: removals filter creator ids,
 * reasoning, and fit scores; additions append to the slate with team-pick
 * reasoning. Dependent sections derive from the slate at render/export time,
 * so they refresh automatically once the slate updates.
 */
export function applyStudioDraftChanges(campaignObject: CampaignObject): ApplyStudioDraftResult {
  const draft = getStudioDraft(campaignObject);
  const removals = draft.changes.filter((c) => c.kind === "remove_creator");
  const additions = draft.changes.filter((c) => c.kind === "add_creator");
  // Refresh markers are display invalidations only — consumed by the apply.
  const unappliedChanges = draft.changes.filter(
    (c) => c.kind !== "remove_creator" && c.kind !== "add_creator" && c.kind !== "refresh_intelligence"
  );

  if (removals.length === 0 && additions.length === 0 && unappliedChanges.length === draft.changes.length) {
    return { campaignObject, removedCreatorIds: [], addedCreatorIds: [], unappliedChanges };
  }

  const removedIds = new Set(removals.map((c) => normalizeCreatorId(c.creatorId)));
  const keep = (id: string) => !removedIds.has(normalizeCreatorId(id));

  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const recommendations = creatorsData.recommendations ?? { creatorIds: [] };

  const existingIds = new Set(
    (recommendations.creatorIds ?? []).map((id) => normalizeCreatorId(id))
  );
  const appendedRefs = additions
    .map((c) => c.creator)
    .filter((ref) => !existingIds.has(normalizeCreatorId(ref.creatorId)) && keep(ref.creatorId));

  const nextRecommendations = {
    ...recommendations,
    creatorIds: [
      ...(recommendations.creatorIds ?? []).filter(keep),
      ...appendedRefs.map((ref) => ref.creatorId),
    ],
    selectedReasoning: [
      ...(recommendations.selectedReasoning ?? []).filter((r) => keep(r.creatorId)),
      ...appendedRefs.map(reasoningForAddedCreator),
    ],
    creatorFitScores: recommendations.creatorFitScores
      ? Object.fromEntries(
          Object.entries(recommendations.creatorFitScores).filter(([id]) => keep(id))
        )
      : undefined,
  };

  const nextData: CreatorsSectionData = {
    ...creatorsData,
    recommendations: nextRecommendations,
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
    addedCreatorIds: appendedRefs.map((ref) => ref.creatorId),
    unappliedChanges,
  };
}
