import type { ClientCreatorSelectionState } from "./constants";
import { isSelectedForCalculator } from "./status";
import type { ClientContentRow, ClientCreatorCard, ClientWorkspaceView } from "./types";

export function selectionMapFromView(
  view: Pick<ClientWorkspaceView, "creators">
): Record<string, ClientCreatorSelectionState> {
  return Object.fromEntries(view.creators.map((creator) => [creator.creatorId, creator.selection]));
}

export function acceptedCreators(
  creators: ClientCreatorCard[],
  selection: Record<string, ClientCreatorSelectionState>,
  approvedIds?: string[] | null
): ClientCreatorCard[] {
  if (approvedIds && approvedIds.length > 0) {
    const ids = new Set(approvedIds);
    return creators.filter((creator) => ids.has(creator.creatorId));
  }
  return creators.filter((creator) => isSelectedForCalculator(selection[creator.creatorId] ?? creator.selection));
}

/** Your Selection shows live Shortlist picks, then the frozen Client Approved roster. */
export function yourSelectionRoster(
  creators: ClientCreatorCard[],
  selection: Record<string, ClientCreatorSelectionState>,
  input?: { selectionConfirmed?: boolean; clientApprovedCreatorIds?: string[] | null }
): ClientCreatorCard[] {
  return acceptedCreators(
    creators,
    selection,
    input?.selectionConfirmed ? input.clientApprovedCreatorIds : null
  );
}

export function contentRowsForSelection(
  rows: ClientContentRow[],
  creators: ClientCreatorCard[],
  selection: Record<string, ClientCreatorSelectionState>
): ClientContentRow[] {
  const selected = acceptedCreators(creators, selection);
  if (selected.length === 0) return [];
  const ids = new Set(selected.map((creator) => creator.creatorId));
  const names = new Set(selected.map((creator) => creator.displayName.trim().toLowerCase()));
  const matched = rows.filter((row) => {
    if (row.creatorId && ids.has(row.creatorId)) return true;
    return names.has(row.creatorName.trim().toLowerCase());
  });
  if (matched.length > 0) return matched;
  return selected.map((creator) => ({
    creatorId: creator.creatorId,
    creatorName: creator.displayName,
    platform: creator.platform ?? "",
    deliverable:
      creator.deliverables ||
      creator.deliverableItems?.map((item) => `${item.quantity ?? 1} ${item.type}`).join(" · ") ||
      "",
  }));
}
