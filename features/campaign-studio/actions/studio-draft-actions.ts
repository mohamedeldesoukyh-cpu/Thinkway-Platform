"use server";

import { saveCampaignObject } from "@/features/campaign-intelligence/services/campaign-object-store";
import type {
  StudioDraftChange,
  StudioDraftCreatorRef,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";

import { reoptimizeCampaignAfterApply } from "../services/apply-draft-reoptimize";
import {
  applyStudioDraftChanges,
  getStudioDraft,
  stageDraftChange,
  unstageDraftChange,
  updateDraftCreatorEnrichment,
  withStudioDraft,
} from "../services/studio-draft";
import {
  persistCampaignObjectOnMessage,
  requireStudioUser,
} from "./persist-campaign-object-on-message";

export type StudioDraftActionResult = {
  ok: boolean;
  message: string;
  draft?: StudioDraftState;
};

/** Client sends the change without a timestamp — the server stamps it. */
export type StageStudioDraftChangeInput =
  | { kind: "remove_creator"; creatorId: string; displayName?: string }
  | { kind: "refresh_intelligence"; creatorId: string; displayName?: string }
  | { kind: "add_creator"; creator: StudioDraftCreatorRef };

type DraftMessageRef = { conversationId: string; messageId: string };

async function patchDraftOnMessage(
  ref: DraftMessageRef,
  patch: (draft: StudioDraftState) => StudioDraftState
): Promise<StudioDraftState | null> {
  const { userId } = await requireStudioUser();
  const next = await persistCampaignObjectOnMessage(
    ref.conversationId,
    ref.messageId,
    userId,
    (object) => withStudioDraft(object, patch(getStudioDraft(object)))
  );
  return next ? getStudioDraft(next) : null;
}

export async function stageStudioDraftChangeAction(
  input: DraftMessageRef & { change: StageStudioDraftChangeInput }
): Promise<StudioDraftActionResult> {
  try {
    const change: StudioDraftChange = {
      ...input.change,
      stagedAt: new Date().toISOString(),
    };
    const draft = await patchDraftOnMessage(input, (current) =>
      stageDraftChange(current, change)
    );
    if (!draft) return { ok: false, message: "Campaign studio message not found." };

    const message =
      input.change.kind === "remove_creator"
        ? "Removal staged — apply all updates to recalculate the plan."
        : input.change.kind === "add_creator"
          ? "Creator staged for addition — apply all updates to bring them into the plan."
          : "Intelligence refresh staged — apply all updates to recalculate.";
    return { ok: true, message, draft };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stage the change.",
    };
  }
}

export async function unstageStudioDraftChangeAction(
  input: DraftMessageRef & { creatorId: string }
): Promise<StudioDraftActionResult> {
  try {
    const draft = await patchDraftOnMessage(input, (current) =>
      unstageDraftChange(current, input.creatorId)
    );
    if (!draft) return { ok: false, message: "Campaign studio message not found." };
    return { ok: true, message: "Pending change undone.", draft };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not undo the change.",
    };
  }
}

/** Persist enrichment progress (pending → enriched/failed) on a staged addition. */
export async function updateStudioDraftEnrichmentAction(
  input: DraftMessageRef & {
    creatorId: string;
    enrichmentStatus: NonNullable<StudioDraftCreatorRef["enrichmentStatus"]>;
  }
): Promise<StudioDraftActionResult> {
  try {
    const draft = await patchDraftOnMessage(input, (current) =>
      updateDraftCreatorEnrichment(current, input.creatorId, input.enrichmentStatus)
    );
    if (!draft) return { ok: false, message: "Campaign studio message not found." };
    return { ok: true, message: "Enrichment status updated.", draft };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update enrichment status.",
    };
  }
}

export async function discardStudioDraftAction(
  input: DraftMessageRef
): Promise<StudioDraftActionResult> {
  try {
    const draft = await patchDraftOnMessage(input, () => ({
      changes: [],
      updatedAt: new Date().toISOString(),
    }));
    if (!draft) return { ok: false, message: "Campaign studio message not found." };
    return { ok: true, message: "All pending changes discarded.", draft };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not discard the draft.",
    };
  }
}

/**
 * Apply All Updates — one bulk operation: apply staged removals and
 * additions to the slate, re-run slate optimization (re-rank with the
 * strategy tier mix, refresh creator roles), recompute the campaign
 * scores from real creator data, and version the result.
 */
export async function applyStudioDraftAction(
  input: DraftMessageRef
): Promise<
  StudioDraftActionResult & {
    removedCount?: number;
    removedCreatorIds?: string[];
    addedCreatorIds?: string[];
    overallScore?: number;
  }
> {
  try {
    const { supabase, userId } = await requireStudioUser();
    let removedCreatorIds: string[] = [];
    let addedCreatorIds: string[] = [];

    const next = await persistCampaignObjectOnMessage(
      input.conversationId,
      input.messageId,
      userId,
      async (object) => {
        // Additions still waiting on enrichment feed the risk score.
        const unenrichedCreatorIds = getStudioDraft(object)
          .changes.filter(
            (c) =>
              c.kind === "add_creator" &&
              c.creator.enrichmentStatus !== "enriched"
          )
          .map((c) => (c.kind === "add_creator" ? c.creator.creatorId : ""))
          .filter(Boolean);

        const result = applyStudioDraftChanges(object);
        removedCreatorIds = result.removedCreatorIds;
        addedCreatorIds = result.addedCreatorIds;
        return reoptimizeCampaignAfterApply(supabase, result.campaignObject, {
          unenrichedCreatorIds,
        });
      }
    );
    if (!next) return { ok: false, message: "Campaign studio message not found." };

    // Exports read from the versioned campaign_objects store — save a new
    // version so the applied slate is what previews, PDFs, and decks render.
    await saveCampaignObject(input.conversationId, next, {
      persistToDb: true,
      supabase,
      userId,
      saveReason: "manual",
    });

    const remaining = getStudioDraft(next);
    const removedCount = removedCreatorIds.length;
    const addedCount = addedCreatorIds.length;
    const performanceData = next.sections.performance.data as
      | { campaignScores?: { overall: number } }
      | undefined;
    const overallScore = performanceData?.campaignScores?.overall;

    const applied = [
      removedCount > 0 ? `${removedCount} removal${removedCount === 1 ? "" : "s"}` : null,
      addedCount > 0 ? `${addedCount} addition${addedCount === 1 ? "" : "s"}` : null,
    ]
      .filter(Boolean)
      .join(" and ");
    const scoreNote = overallScore != null ? ` Overall campaign score: ${overallScore}/100.` : "";
    const remainingNote =
      remaining.changes.length > 0
        ? ` ${remaining.changes.length} staged change${remaining.changes.length === 1 ? "" : "s"} could not be applied and remain pending.`
        : "";
    return {
      ok: true,
      message: `Campaign updated — ${applied || "pending changes"} applied, slate re-optimized, and scores recalculated.${scoreNote}${remainingNote}`,
      draft: remaining,
      removedCount,
      removedCreatorIds,
      addedCreatorIds,
      overallScore,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not apply updates.",
    };
  }
}
