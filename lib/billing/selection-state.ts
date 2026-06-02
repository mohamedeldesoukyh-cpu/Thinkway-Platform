import type { OperationalSelectionState } from "@/lib/billing/operational-selection";

/** Fast equality check to skip React state updates when selection unchanged. */
export function selectionStateEqual(
  a: OperationalSelectionState,
  b: OperationalSelectionState
): boolean {
  if (a === b) return true;
  if (
    a.line_ids.size !== b.line_ids.size ||
    a.deliverable_ids.size !== b.deliverable_ids.size ||
    a.post_ids.size !== b.post_ids.size
  ) {
    return false;
  }
  for (const id of a.line_ids) {
    if (!b.line_ids.has(id)) return false;
  }
  for (const id of a.deliverable_ids) {
    if (!b.deliverable_ids.has(id)) return false;
  }
  for (const id of a.post_ids) {
    if (!b.post_ids.has(id)) return false;
  }
  return true;
}
