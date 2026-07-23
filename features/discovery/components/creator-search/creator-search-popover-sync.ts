/**
 * Whether a debounced toolbar draft should propagate to parent search state.
 *
 * Blocks stale debounced values after an external clear (chip X, URL sync) while
 * still allowing normal typing where the parent query lags behind local draft.
 */
export function shouldPropagateDebouncedSearchDraft(input: {
  debouncedDraft: string;
  draftSearch: string;
  searchQuery: string;
  /** searchQuery value before the current render/effect cycle. */
  previousSearchQuery: string;
}): boolean {
  const { debouncedDraft, draftSearch, searchQuery, previousSearchQuery } = input;

  if (debouncedDraft === searchQuery) return false;
  if (debouncedDraft !== draftSearch) return false;
  // Parent query changed externally; local draft is still resyncing.
  if (previousSearchQuery !== searchQuery) return false;
  return true;
}
