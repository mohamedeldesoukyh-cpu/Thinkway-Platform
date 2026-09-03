/** Design spec §4 / §10 — `.tw-g` child count must equal `--cols` track count. */

export function countCssGridTracks(cols: string): number {
  const tokens = cols
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return tokens.length;
}

export function countTwGOccupiedTracks(
  childColumnSpans: readonly number[]
): number {
  return childColumnSpans.reduce((sum, span) => sum + Math.max(1, span), 0);
}

export function twGTracksAlign(
  cols: string,
  childColumnSpans: readonly number[]
): boolean {
  return countCssGridTracks(cols) === countTwGOccupiedTracks(childColumnSpans);
}
