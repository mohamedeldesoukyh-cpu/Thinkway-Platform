import type {
  StudioDraftChange,
  StudioDraftCreatorRef,
} from "@/features/campaign-intelligence/types/section-schemas";

/**
 * Staging a creator choice — as an addition or as a replacement.
 *
 * `replace_creator` is already a first-class draft change with a
 * `replacement: StudioDraftCreatorRef`, and `applyStudioDraftChanges` +
 * `reoptimizeCampaignAfterApply` already commit and re-score it. So replacing
 * a selected creator is the SAME staging path as adding one, with a target;
 * nothing new is persisted and no second selection system exists.
 *
 * All three replacement routes end here, and they differ only in the `source`
 * the ref carries — which is what decides enrichment:
 *
 *   - another recommended creator  → "discovery"    (already enriched)
 *   - a creator found in Discovery → "discovery"    (already enriched)
 *   - an Instagram/TikTok URL or handle → "external_url" (auto-enriches)
 */

export type StudioCreatorReplacementTarget = {
  /** The selected creator being replaced. */
  creatorId: string;
  displayName?: string;
};

export function buildCreatorSelectionChange(input: {
  replacement: StudioDraftCreatorRef;
  /** Omitted for a plain addition. */
  target?: StudioCreatorReplacementTarget | null;
  stagedAt: string;
}): StudioDraftChange {
  if (input.target?.creatorId?.trim()) {
    return {
      kind: "replace_creator",
      creatorId: input.target.creatorId,
      displayName: input.target.displayName,
      replacement: input.replacement,
      stagedAt: input.stagedAt,
    };
  }
  return {
    kind: "add_creator",
    creator: input.replacement,
    stagedAt: input.stagedAt,
  };
}

/**
 * The id `unstageStudioDraftChangeAction` needs to undo this change.
 *
 * `unstageDraftChange` matches on the change's target creator, which for a
 * replacement is the creator that was replaced — not the incoming one. Undo
 * therefore restores the original selected creator, whichever route the
 * replacement came from.
 */
export function undoTargetIdForSelectionChange(change: StudioDraftChange): string | null {
  if (change.kind === "replace_creator") return change.creatorId;
  if (change.kind === "add_creator") return change.creator.creatorId;
  return null;
}

/**
 * Enrichment posture for a chosen creator.
 *
 * A creator that came from Discovery already carries Discovery's data, so it
 * is not re-enriched — the existing behaviour for Discovery picks. A creator
 * named only by URL or handle has nothing yet, so enrichment runs and the card
 * stays in a visible pending state until it finishes. `queued` reflects what
 * the server actually confirmed; an unqueued creator must not claim progress.
 */
export function enrichmentStatusForSelection(input: {
  source: StudioDraftCreatorRef["source"];
  queued: boolean;
}): NonNullable<StudioDraftCreatorRef["enrichmentStatus"]> {
  if (input.source !== "external_url") return "not_requested";
  return input.queued ? "pending" : "not_requested";
}
