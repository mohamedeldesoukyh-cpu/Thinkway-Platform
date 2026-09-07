/**
 * Typeahead helpers for Creator Search filter chip grids.
 * Pure — safe for unit tests and client components.
 */

/** Narrow chip options by the Add… draft. Does not touch applied filters. */
export function filterFacetOptionsByDraft<T>(
  items: readonly T[],
  draft: string,
  getLabel: (item: T) => string
): T[] {
  const needle = draft.trim().toLowerCase();
  if (!needle) return [...items];
  return items.filter((item) => getLabel(item).toLowerCase().includes(needle));
}

/**
 * Prefer an existing chip label when the draft is a unique partial match
 * (e.g. cosm → Beauty & Cosmetics). Otherwise keep the typed value.
 */
export function resolveFacetDraftToOption(
  draft: string,
  options: readonly string[]
): string {
  const value = draft.trim();
  if (!value) return "";
  const needle = value.toLowerCase();
  const exact = options.find((option) => option.toLowerCase() === needle);
  if (exact) return exact;
  const starts = options.filter((option) =>
    option.toLowerCase().startsWith(needle)
  );
  if (starts.length === 1) return starts[0];
  const contains = options.filter((option) =>
    option.toLowerCase().includes(needle)
  );
  if (contains.length === 1) return contains[0];
  return value;
}
