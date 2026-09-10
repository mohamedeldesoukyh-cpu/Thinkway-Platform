/**
 * Where every hydrated creator goes on the Creators screen.
 *
 * The three groups were each derived from a different list, and the arithmetic
 * did not close:
 *
 *   - the SELECTED group filtered the GATED list
 *     (`selectStudioRecommendedVendors`, which drops a creator out of market,
 *     off the brief mix, or carrying a negative campaign decision);
 *   - the ALTERNATIVES group was the ungated hydrated pool MINUS the slate.
 *
 * So a slate member that failed the render-time gate belonged to neither: it
 * was not in the gated list, and it was not outside the slate. It vanished.
 * Content reads the same slate ungated, which is exactly why Content listed ten
 * creators while this screen showed three, and why the alternatives count
 * ballooned — nothing was wrong with Discovery or the slate.
 *
 * This closes the arithmetic. Every hydrated creator lands in exactly one
 * group, and every slate member is either recommended or shown for review with
 * the gate's verdict — never dropped, never quietly recounted as recommended.
 */

export type StudioCreatorPartition<T> = {
  /** On the slate and past the gate — the campaign's recommendation. */
  selected: T[];
  /** On the slate but rejected by the gate — shown, not counted as recommended. */
  needsReview: T[];
  /** Hydrated but not on the slate — Discovery alternatives. */
  alternatives: T[];
  /** Slate ids that never hydrated at all (a rendering loss, not a shortfall). */
  missingSlateIds: string[];
};

export function partitionStudioCreatorGroups<T>(input: {
  /** Every hydrated creator, ungated. */
  pool: T[];
  /** Pool members that pass the render-time recommendation gate. */
  gated: T[];
  /** Canonical recommendation ids the campaign persisted. */
  slateIds: string[];
  idOf: (item: T) => string | null | undefined;
  /** Strips id prefixes so `inf:x`, `dis:x` and `x` are one creator. */
  normalize: (id: string) => string;
}): StudioCreatorPartition<T> {
  const { pool, gated, slateIds, idOf, normalize } = input;

  const keyOf = (item: T): string => {
    const raw = idOf(item);
    return raw ? normalize(raw) : "";
  };

  const slateKeys = new Set(slateIds.map(normalize).filter(Boolean));
  const selected: T[] = [];
  const needsReview: T[] = [];
  const alternatives: T[] = [];
  const placed = new Set<string>();

  // Selected keeps the gated order — that list is already ranked.
  for (const item of gated) {
    const key = keyOf(item);
    if (!key || !slateKeys.has(key) || placed.has(key)) continue;
    placed.add(key);
    selected.push(item);
  }

  for (const item of pool) {
    const key = keyOf(item);
    if (!key || placed.has(key)) continue;
    placed.add(key);
    if (slateKeys.has(key)) needsReview.push(item);
    else alternatives.push(item);
  }

  const missingSlateIds = slateIds.filter((id) => {
    const key = normalize(id);
    return Boolean(key) && !placed.has(key);
  });

  return { selected, needsReview, alternatives, missingSlateIds };
}
