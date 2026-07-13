import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  SlateCreatorRecommendation,
  SlateRecommendationRole,
  StudioDraftChange,
  StudioDraftCreatorRef,
  StudioDraftState,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";

import type { CampaignStudioSectionId } from "../types/campaign-studio";
import {
  previewRecommendationsFromDraft,
  previewSlateIntelligenceFromDraft,
  previewVendorDecisionsFromDraft,
} from "./studio-draft-preview";

/** Creator ids appear both raw and "inf:"-prefixed across sections — compare normalized. */
export function normalizeCreatorId(id: string): string {
  return id.trim().replace(/^inf:/, "");
}

function sameCreator(a: string, b: string): boolean {
  return normalizeCreatorId(a) === normalizeCreatorId(b);
}

function targetCreatorIdOf(change: StudioDraftChange): string | undefined {
  switch (change.kind) {
    case "add_creator":
      return change.creator.creatorId;
    case "replace_shortlist":
    case "merge_shortlist":
      return undefined;
    default:
      return change.creatorId;
  }
}

export function getStudioDraft(campaignObject: CampaignObject | undefined): StudioDraftState {
  const creatorsData = (campaignObject?.sections.creators.data ?? {}) as CreatorsSectionData;
  return creatorsData.studioDraft ?? { changes: [], updatedAt: "" };
}

/**
 * Stage a change into the draft. One pending change per creator (last wins);
 * opposite operations cancel out instead of stacking.
 */
export function stageDraftChange(
  draft: StudioDraftState,
  change: StudioDraftChange
): StudioDraftState {
  const changeCreatorId = targetCreatorIdOf(change);

  let remaining = draft.changes.filter((existing) => {
    if (change.kind === "replace_shortlist" && existing.kind === "replace_shortlist") {
      return false;
    }
    if (change.kind === "merge_shortlist" && existing.kind === "merge_shortlist") {
      return false;
    }
    if (changeCreatorId == null) return true;
    const existingCreatorId = targetCreatorIdOf(existing);
    if (existingCreatorId == null) return true;
    return !sameCreator(existingCreatorId, changeCreatorId);
  });

  const dropped = draft.changes.length - remaining.length;
  const cancelledAdd =
    change.kind === "remove_creator" &&
    dropped > 0 &&
    draft.changes.some(
      (existing) =>
        existing.kind === "add_creator" &&
        sameCreator(existing.creator.creatorId, changeCreatorId!)
    );

  if (cancelledAdd) {
    remaining = remaining.filter(
      (existing) =>
        !(
          existing.kind === "remove_creator" &&
          sameCreator(existing.creatorId, changeCreatorId!)
        )
    );
    return { changes: remaining, updatedAt: new Date().toISOString() };
  }

  return {
    changes: [...remaining, change],
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
      const existingCreatorId = targetCreatorIdOf(existing);
      if (existingCreatorId == null) return true;
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
    const target = targetCreatorIdOf(change);
    return target != null && sameCreator(target, creatorId);
  });
}

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

const SLATE_CHANGE_KINDS = new Set<StudioDraftChange["kind"]>([
  "remove_creator",
  "add_creator",
  "replace_creator",
  "replace_shortlist",
  "merge_shortlist",
  "approve_creator",
  "reject_creator",
  "shortlist_creator",
  "promote_main",
  "demote_alternative",
]);

export function outdatedSectionsForDraft(
  draft: StudioDraftState
): Set<CampaignStudioSectionId> {
  const outdated = new Set<CampaignStudioSectionId>();
  for (const change of draft.changes) {
    const affected =
      change.kind === "refresh_intelligence"
        ? REFRESH_DEPENDENT_SECTIONS
        : SLATE_CHANGE_KINDS.has(change.kind)
          ? SLATE_DEPENDENT_SECTIONS
          : REFRESH_DEPENDENT_SECTIONS;
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

function applyRoleOverrides(
  recommendations: SlateCreatorRecommendation[],
  changes: StudioDraftChange[]
): SlateCreatorRecommendation[] {
  const roleOverrides = new Map<string, SlateRecommendationRole>();
  for (const change of changes) {
    if (change.kind === "promote_main") roleOverrides.set(normalizeCreatorId(change.creatorId), "main");
    if (change.kind === "demote_alternative") {
      roleOverrides.set(normalizeCreatorId(change.creatorId), "maybe");
    }
  }
  if (roleOverrides.size === 0) return recommendations;

  return recommendations.map((rec) => {
    const override = roleOverrides.get(normalizeCreatorId(rec.creatorId));
    if (!override) return rec;
    return {
      ...rec,
      role: override,
      priority: override === "main" ? "high" : "medium",
    };
  });
}

export type ApplyStudioDraftResult = {
  campaignObject: CampaignObject;
  removedCreatorIds: string[];
  addedCreatorIds: string[];
  unappliedChanges: StudioDraftChange[];
};

/**
 * Apply staged slate edits in one operation. Dependent sections regenerate
 * via commitCreatorSlateAndRegeneratePlan after this returns.
 */
export function applyStudioDraftChanges(campaignObject: CampaignObject): ApplyStudioDraftResult {
  const draft = getStudioDraft(campaignObject);
  if (draft.changes.length === 0) {
    return { campaignObject, removedCreatorIds: [], addedCreatorIds: [], unappliedChanges: [] };
  }

  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const beforeIds = new Set(
    (creatorsData.recommendations?.creatorIds ?? []).map(normalizeCreatorId)
  );

  const nextRecommendations = previewRecommendationsFromDraft(
    creatorsData.recommendations,
    draft.changes
  );

  const addedCreatorIds = nextRecommendations.creatorIds.filter(
    (id) => !beforeIds.has(normalizeCreatorId(id))
  );
  const removedCreatorIds = [...beforeIds].filter(
    (id) => !nextRecommendations.creatorIds.some((cid) => sameCreator(cid, id))
  );

  const vendorDecisions = previewVendorDecisionsFromDraft(
    creatorsData.vendorDecisions,
    draft.changes
  );

  const shortlistCreatorChanges = draft.changes.filter((c) => c.kind === "shortlist_creator");
  const stagedLinkedShortlistId = [...shortlistCreatorChanges]
    .reverse()
    .find((c) => c.kind === "shortlist_creator" && c.linkedShortlistId)?.linkedShortlistId;

  const replaceShortlist = [...draft.changes]
    .reverse()
    .find((c) => c.kind === "replace_shortlist");
  const mergeShortlist = [...draft.changes]
    .reverse()
    .find((c) => c.kind === "merge_shortlist");
  const shortlistChange = replaceShortlist ?? mergeShortlist;

  const additions = draft.changes.filter((c) => c.kind === "add_creator");
  const appendedRefs = additions
    .map((c) => (c.kind === "add_creator" ? c.creator : null))
    .filter((ref): ref is StudioDraftCreatorRef => ref != null)
    .filter((ref) => addedCreatorIds.some((id) => sameCreator(id, ref.creatorId)));

  const existingReasoning = nextRecommendations.selectedReasoning ?? [];
  const reasoningById = new Map(
    existingReasoning.map((entry) => [normalizeCreatorId(entry.creatorId), entry])
  );
  for (const ref of appendedRefs) {
    if (!reasoningById.has(normalizeCreatorId(ref.creatorId))) {
      reasoningById.set(normalizeCreatorId(ref.creatorId), reasoningForAddedCreator(ref));
    }
  }

  let slateIntelligence = previewSlateIntelligenceFromDraft(
    creatorsData.slateIntelligence,
    draft.changes
  );
  if (slateIntelligence?.recommendations) {
    slateIntelligence = {
      ...slateIntelligence,
      recommendations: applyRoleOverrides(slateIntelligence.recommendations, draft.changes),
    };
  }

  const appliedShortlistIds = shortlistChange
    ? [
        ...(creatorsData.appliedShortlistIds ?? []).filter(
          (id) =>
            shortlistChange.kind !== "replace_shortlist" ||
            id !== shortlistChange.payload.shortlistId
        ),
        shortlistChange.payload.shortlistId,
      ]
    : creatorsData.appliedShortlistIds;

  const shortlistVendorDecisions =
    shortlistChange?.kind === "replace_shortlist" ? {} : vendorDecisions;

  const nextData: CreatorsSectionData = {
    ...creatorsData,
    recommendations: {
      ...nextRecommendations,
      selectedReasoning: [...reasoningById.values()],
    },
    vendorDecisions: shortlistVendorDecisions,
    slateIntelligence,
    studioDraft: undefined,
    ...(stagedLinkedShortlistId ? { linkedShortlistId: stagedLinkedShortlistId } : {}),
    ...(shortlistCreatorChanges.length > 0 ? { phase: "shortlist" as const } : {}),
    ...(shortlistChange &&
    (shortlistChange.kind === "replace_shortlist" || shortlistChange.kind === "merge_shortlist")
      ? {
          phase: "shortlist" as const,
          linkedShortlistId: shortlistChange.payload.shortlistId,
          appliedShortlistIds,
          lastShortlistAt: new Date().toISOString(),
        }
      : {}),
  };

  return {
    campaignObject: {
      ...campaignObject,
      sections: {
        ...campaignObject.sections,
        creators: { ...campaignObject.sections.creators, data: nextData },
      },
      updatedAt: new Date().toISOString(),
    },
    removedCreatorIds: removedCreatorIds.map((id) => {
      const original = creatorsData.recommendations?.creatorIds?.find((cid) =>
        sameCreator(cid, id)
      );
      return original ?? id;
    }),
    addedCreatorIds,
    unappliedChanges: [],
  };
}
