/**
 * Session-only Undo/Redo for Commercial Workspace draft maps.
 * Cleared on Save (caller resets). Not Commercial Audit / Revision history.
 */

import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";

export type CommercialDraftSnapshot = Record<string, QuotationRowDraft>;

export type CommercialDraftHistoryState = {
  past: CommercialDraftSnapshot[];
  present: CommercialDraftSnapshot;
  future: CommercialDraftSnapshot[];
};

const MAX_HISTORY = 50;

function cloneMap(
  drafts: Record<string, QuotationRowDraft | undefined>
): CommercialDraftSnapshot {
  const next: CommercialDraftSnapshot = {};
  for (const [id, draft] of Object.entries(drafts)) {
    if (draft) next[id] = { ...draft };
  }
  return next;
}

export function createCommercialDraftHistory(
  drafts: Record<string, QuotationRowDraft | undefined>
): CommercialDraftHistoryState {
  return {
    past: [],
    present: cloneMap(drafts),
    future: [],
  };
}

export function pushCommercialDraftHistory(
  state: CommercialDraftHistoryState,
  nextDrafts: Record<string, QuotationRowDraft | undefined>
): CommercialDraftHistoryState {
  const present = cloneMap(nextDrafts);
  const past = [...state.past, state.present].slice(-MAX_HISTORY);
  return { past, present, future: [] };
}

export function undoCommercialDraftHistory(
  state: CommercialDraftHistoryState
): CommercialDraftHistoryState | null {
  if (state.past.length === 0) return null;
  const past = [...state.past];
  const previous = past.pop()!;
  return {
    past,
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function redoCommercialDraftHistory(
  state: CommercialDraftHistoryState
): CommercialDraftHistoryState | null {
  if (state.future.length === 0) return null;
  const [next, ...future] = state.future;
  return {
    past: [...state.past, state.present],
    present: next!,
    future,
  };
}

export function resetCommercialDraftHistory(
  drafts: Record<string, QuotationRowDraft | undefined>
): CommercialDraftHistoryState {
  return createCommercialDraftHistory(drafts);
}

export function canUndoCommercialDraft(state: CommercialDraftHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedoCommercialDraft(state: CommercialDraftHistoryState): boolean {
  return state.future.length > 0;
}
