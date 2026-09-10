/**
 * `creatorIds` and `selectedReasoning` describe the SAME slate.
 *
 * Browser evidence: the Creators screen and Campaign Analysis reported 10
 * creators while Content rendered 6, and the Package footer said "6
 * vendor(s)". Nothing was filtering Content — the two halves of one persisted
 * `recommendations` object had drifted apart. `creatorIds` had ten ids;
 * `selectedReasoning` had six rows.
 *
 * Cause: `reoptimizeCampaignAfterApply` rebuilds both from the hydrated cards,
 * but `selectedReasoning` was rebuilt with `if (!existing) continue` — a slate
 * member with no PRIOR reasoning row was dropped from the rebuilt array while
 * its id was still written to `creatorIds`. The loss is cumulative: once a row
 * is gone it can never return, because the rebuild only preserves rows that
 * already exist.
 *
 * Consumers split along that seam. `creatorIds` feeds the Creators header and
 * Campaign Analysis; `selectedReasoning` feeds Content, the client content
 * projection and the quotation mapper. So the same campaign had two creator
 * counts, both read correctly from their own field.
 *
 * This module owns the invariant and the repair. It never invents a metric: a
 * synthesised row carries the identity the slate already holds and says plainly
 * that its campaign rationale is missing.
 */

import type {
  CreatorRecommendationSectionData,
  VendorSelectedReasoning,
} from "@/features/campaign-intelligence/types/section-schemas";

/** Ids in `creatorIds` with no `selectedReasoning` row, and the reverse. */
export type CreatorSlateIntegrity = {
  /** On `creatorIds`, missing from `selectedReasoning` — invisible to Content. */
  missingReasoningIds: string[];
  /** In `selectedReasoning`, absent from `creatorIds` — invisible to Creators. */
  orphanReasoningIds: string[];
  consistent: boolean;
};

export function checkCreatorSlateIntegrity(
  recommendations: CreatorRecommendationSectionData | undefined,
  normalize: (id: string) => string
): CreatorSlateIntegrity {
  const ids = recommendations?.creatorIds ?? [];
  const rows = recommendations?.selectedReasoning ?? [];
  const reasoningKeys = new Set(rows.map((row) => normalize(row.creatorId)).filter(Boolean));
  const idKeys = new Set(ids.map(normalize).filter(Boolean));

  const missingReasoningIds = ids.filter((id) => {
    const key = normalize(id);
    return Boolean(key) && !reasoningKeys.has(key);
  });
  const orphanReasoningIds = rows
    .map((row) => row.creatorId)
    .filter((id) => {
      const key = normalize(id);
      return Boolean(key) && !idKeys.has(key);
    });

  return {
    missingReasoningIds,
    orphanReasoningIds,
    consistent: missingReasoningIds.length === 0 && orphanReasoningIds.length === 0,
  };
}

/**
 * A reasoning row for a slate member that has none.
 *
 * Identity only, plus an honest statement that the campaign rationale is
 * missing. No fabricated audience, risk, confidence or evidence — the operator
 * can see that this creator needs its rationale regenerated, which is the true
 * state, instead of the creator vanishing from Content.
 */
export function placeholderReasoningForSlateMember(input: {
  creatorId: string;
  displayName?: string;
  handle?: string;
  platform?: string;
  /** Tier from the hydrated card when one exists. */
  expectedRole?: string;
}): VendorSelectedReasoning {
  return {
    creatorId: input.creatorId,
    displayName: input.displayName,
    handle: input.handle,
    platform: input.platform,
    whySelected:
      "On the campaign slate. Campaign rationale is not recorded for this creator — regenerate the creator plan to restore it.",
    expectedRole: input.expectedRole?.trim() || "Creator",
    audienceMatch: "",
    risk: "",
    alternative: "",
    confidence: 0,
    evidence: "",
    tradeoff: "",
  };
}

/**
 * Bring `selectedReasoning` back into line with `creatorIds`.
 *
 * Order follows `creatorIds`, so Content and the Creators list read the slate
 * in one order. Existing rows are preserved exactly; only genuinely missing
 * ones are filled, and a row whose creator has left the slate is dropped.
 */
export function reconcileCreatorSlateReasoning(input: {
  creatorIds: string[];
  selectedReasoning: VendorSelectedReasoning[];
  normalize: (id: string) => string;
  /** Identity for an id that has no reasoning row, when the caller has it. */
  identityOf?: (id: string) => {
    displayName?: string;
    handle?: string;
    platform?: string;
    expectedRole?: string;
  } | undefined;
}): VendorSelectedReasoning[] {
  const { creatorIds, selectedReasoning, normalize, identityOf } = input;
  const rowByKey = new Map(
    selectedReasoning.map((row) => [normalize(row.creatorId), row] as const)
  );

  const reconciled: VendorSelectedReasoning[] = [];
  const seen = new Set<string>();
  for (const id of creatorIds) {
    const key = normalize(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const existing = rowByKey.get(key);
    if (existing) {
      reconciled.push(existing);
      continue;
    }
    reconciled.push(
      placeholderReasoningForSlateMember({ creatorId: id, ...(identityOf?.(id) ?? {}) })
    );
  }
  return reconciled;
}
