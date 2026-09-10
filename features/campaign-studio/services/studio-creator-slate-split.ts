/**
 * Selected creators vs recommended-but-not-selected, derived from what the
 * campaign already persists. No new column and no new section field.
 *
 * `creators.data.recommendations.creatorIds` is the composed slate — the
 * creators the campaign selected. `creators.data.discovery.creatorIds` is the
 * pool those were composed from, which `resolveCreatorCounts` already reads.
 * The difference is therefore the set of creators Thinkway recommended and did
 * not select, and it is available without persisting anything new.
 *
 * The existing `recommendationCount` keeps its meaning (the selected slate).
 * `candidatePoolCount` here is a separate number: everything the operator may
 * choose from, selected or not.
 */

export type CreatorSlateSplit = {
  /** The composed slate, in its persisted order. */
  selectedIds: string[];
  /** Recommended, not selected — replacement candidates, in pool order. */
  remainingIds: string[];
  selectedCount: number;
  /** selected + remaining. NOT the existing `recommendationCount`. */
  candidatePoolCount: number;
};

/**
 * Grouping key: strip both id prefixes so one creator cannot land in both
 * groups, or be hydrated twice, because the slate stored `inf:x` and the pool
 * stored `x`.
 *
 * Deliberately NOT `studio-draft.normalizeCreatorId`, which strips only
 * `inf:` — that is the draft system's identity for matching add/remove/replace
 * changes and is left exactly as it is. This matches the hydration layer's own
 * `normalizeIdKey`, which is the right comparison for display grouping.
 */
export function creatorGroupingKey(id: string): string {
  return id.trim().replace(/^inf:/, "").replace(/^dis:/, "");
}

export function splitRecommendedCreatorIds(input: {
  /** `resolveCreatorCounts().recommendationIds` — the selected slate. */
  recommendationIds: string[];
  /** `resolveCreatorCounts().discoveryIds` — the pool it was composed from. */
  discoveryIds: string[];
  /**
   * Creators an applied edit already removed from this campaign. They are not
   * offered back as candidates: the operator took them out deliberately.
   */
  excludeIds?: string[];
}): CreatorSlateSplit {
  const selectedIds: string[] = [];
  const seen = new Set<string>();
  for (const id of input.recommendationIds) {
    const key = creatorGroupingKey(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selectedIds.push(id);
  }

  const excluded = new Set((input.excludeIds ?? []).map(creatorGroupingKey).filter(Boolean));

  const remainingIds: string[] = [];
  for (const id of input.discoveryIds) {
    const key = creatorGroupingKey(id);
    if (!key || seen.has(key) || excluded.has(key)) continue;
    seen.add(key);
    remainingIds.push(id);
  }

  return {
    selectedIds,
    remainingIds,
    selectedCount: selectedIds.length,
    candidatePoolCount: selectedIds.length + remainingIds.length,
  };
}

/**
 * Every id the Creators stage needs hydrated: the slate plus its candidates.
 *
 * One list so both groups go through the SAME `useCreatorHydration` instance —
 * a second hook would run its own three waves, duplicate the server actions and
 * reintroduce the avatar churn `preserveResolvedAvatar` just removed.
 */
export function creatorIdsToHydrate(split: CreatorSlateSplit): string[] {
  return [...split.selectedIds, ...split.remainingIds];
}
