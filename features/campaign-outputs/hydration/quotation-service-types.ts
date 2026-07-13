/**
 * Parse quotation ad-type labels into individual calendar slots.
 * Handles "1× IG Reel + 1× TT Video" and "1× IG Reel · 1× TT Video" summaries.
 */
export function parseAggregatedServiceLabel(label: string): string[] {
  const normalized = label.trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/\s*(?:\+|·)\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [normalized];
}

/** Normalize creator display names for quotation ↔ slate matching. */
export function normalizeCreatorMatchKey(name: string): string {
  const trimmed = name.trim();
  const at = trimmed.indexOf(" (@");
  return (at > 0 ? trimmed.slice(0, at) : trimmed).trim().toLowerCase();
}
