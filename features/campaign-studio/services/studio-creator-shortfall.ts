/**
 * Requested quantity versus the slate that was actually composed.
 *
 * `composeCreatorSlate` deliberately does NOT pad a short slate with a creator
 * whose tier the Strategy never asked for — it records `tierShortfall` and
 * comes up short instead. The Creators header showed "Required 10 / Qualified
 * 9" and left the operator to infer the rest, so a genuine one-creator
 * shortfall read like a bug.
 *
 * This states it from counts that already exist. It never changes a count and
 * never invents a creator.
 */

export type StudioCreatorShortfall = {
  requested: number;
  recommended: number;
  shortfall: number;
  /** True when the slate is short of what the campaign asked for. */
  hasShortfall: boolean;
  /** One line for the operator, or null when there is nothing to say. */
  summary: string | null;
};

export function resolveStudioCreatorShortfall(input: {
  /** The quantity the campaign asked for, or Thinkway's recommendation. */
  requestedCount: number | null | undefined;
  /** Canonical recommendation ids actually on the slate. */
  recommendedCount: number;
}): StudioCreatorShortfall {
  const requested =
    input.requestedCount != null && Number.isFinite(input.requestedCount) && input.requestedCount > 0
      ? Math.round(input.requestedCount)
      : 0;
  const recommended = Math.max(0, Math.round(input.recommendedCount));
  const shortfall = Math.max(0, requested - recommended);

  if (requested === 0 || shortfall === 0) {
    return { requested, recommended, shortfall: 0, hasShortfall: false, summary: null };
  }

  return {
    requested,
    recommended,
    shortfall,
    hasShortfall: true,
    summary: `${requested} requested · ${recommended} recommended · ${shortfall} creator${
      shortfall === 1 ? "" : "s"
    } shortfall`,
  };
}

/**
 * Creators the campaign persisted that never made it onto the screen.
 *
 * A shortfall is a supply outcome; ids that fail to render are a defect. They
 * look identical to an operator, so they are counted apart. Identity is the
 * canonical creator id — never a display name or handle, which repeat across
 * real creators.
 */
export function unrenderedCanonicalCreatorIds(input: {
  canonicalIds: string[];
  renderedIds: string[];
  normalize: (id: string) => string;
}): string[] {
  const rendered = new Set(
    input.renderedIds.map((id) => input.normalize(id)).filter(Boolean)
  );
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const id of input.canonicalIds) {
    const key = input.normalize(id);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (!rendered.has(key)) missing.push(id);
  }
  return missing;
}
