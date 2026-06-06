import {
  isOperationalRowUiSelectable,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";

export type OperationalSelectionState = {
  line_ids: Set<string>;
  deliverable_ids: Set<string>;
  post_ids: Set<string>;
};

export type OperationalSelectionPayload = {
  line_ids: string[];
  deliverable_ids: string[];
  post_ids: string[];
};

export type RowSelectionStatus = "unchecked" | "indeterminate" | "checked";

export function createEmptySelection(): OperationalSelectionState {
  return {
    line_ids: new Set(),
    deliverable_ids: new Set(),
    post_ids: new Set(),
  };
}

export function cloneSelection(selection: OperationalSelectionState): OperationalSelectionState {
  return {
    line_ids: new Set(selection.line_ids),
    deliverable_ids: new Set(selection.deliverable_ids),
    post_ids: new Set(selection.post_ids),
  };
}

export function payloadToSelection(
  payload?: Partial<OperationalSelectionPayload>
): OperationalSelectionState {
  return {
    line_ids: new Set(payload?.line_ids ?? []),
    deliverable_ids: new Set(payload?.deliverable_ids ?? []),
    post_ids: new Set(payload?.post_ids ?? []),
  };
}

export function selectionToPayload(selection: OperationalSelectionState): OperationalSelectionPayload {
  return {
    line_ids: [...selection.line_ids],
    deliverable_ids: [...selection.deliverable_ids],
    post_ids: [...selection.post_ids],
  };
}

/** Expand ancestor selection into explicit selectable leaf row ids for server actions. */
export function expandEffectivelySelectedLeaves(
  selection: OperationalSelectionState,
  rootRows: OperationalBillingRow[]
): OperationalSelectionState {
  const expanded = createEmptySelection();

  const visit = (node: OperationalBillingRow) => {
    for (const child of node.children ?? []) {
      visit(child);
    }
    if (!isOperationalRowUiSelectable(node)) return;
    if (!isRowEffectivelySelected(node, selection, rootRows)) return;
    addRowToSelection(expanded, node);
  };

  for (const root of rootRows) {
    visit(root);
  }

  return expanded;
}

/**
 * Submit payload for invoice actions — drops parent assignment line_ids when
 * granular deliverable/post rows are selected (avoids stale bulk-selection ids).
 */
export function selectionToSubmitPayload(
  selection: OperationalSelectionState,
  rootRows: OperationalBillingRow[]
): OperationalSelectionPayload {
  const explicit = expandEffectivelySelectedLeaves(selection, rootRows);
  const prunedLineIds: string[] = [];

  for (const lineId of explicit.line_ids) {
    const path = findRowPath(rootRows, lineId);
    const assignment = path?.[0];
    if (!assignment || assignment.kind !== "assignment") continue;

    const pricingMode = assignment.pricing_mode ?? "package";
    const selectableDescendants = getSelectableDescendantRows(assignment);
    const hasDirectGranular = selectableDescendants.some((descendant) =>
      isRowDirectlySelected(descendant, explicit)
    );

    if (pricingMode === "per_deliverable") {
      if (!hasDirectGranular) prunedLineIds.push(lineId);
      continue;
    }

    if (selectableDescendants.length === 0) {
      prunedLineIds.push(lineId);
      continue;
    }

    const allDescendantsSelected = selectableDescendants.every((descendant) =>
      isRowDirectlySelected(descendant, explicit)
    );
    if (allDescendantsSelected) prunedLineIds.push(lineId);
  }

  return {
    line_ids: prunedLineIds,
    deliverable_ids: [...explicit.deliverable_ids],
    post_ids: [...explicit.post_ids],
  };
}

export function countSubmitPayload(payload: OperationalSelectionPayload): number {
  return payload.line_ids.length + payload.deliverable_ids.length + payload.post_ids.length;
}

export function countSelection(selection: OperationalSelectionState): number {
  return selection.line_ids.size + selection.deliverable_ids.size + selection.post_ids.size;
}

function addRowToSelection(selection: OperationalSelectionState, row: OperationalBillingRow): void {
  if (row.kind === "assignment") selection.line_ids.add(row.id);
  else if (row.kind === "deliverable_group") selection.deliverable_ids.add(row.id);
  else selection.post_ids.add(row.id);
}

function removeRowFromSelection(selection: OperationalSelectionState, row: OperationalBillingRow): void {
  if (row.kind === "assignment") selection.line_ids.delete(row.id);
  else if (row.kind === "deliverable_group") selection.deliverable_ids.delete(row.id);
  else selection.post_ids.delete(row.id);
}

export function isRowDirectlySelected(
  row: OperationalBillingRow,
  selection: OperationalSelectionState
): boolean {
  if (row.kind === "assignment") return selection.line_ids.has(row.id);
  if (row.kind === "deliverable_group") return selection.deliverable_ids.has(row.id);
  return selection.post_ids.has(row.id);
}

/** All descendant rows excluding the node itself. */
export function getDescendantRows(row: OperationalBillingRow): OperationalBillingRow[] {
  const descendants: OperationalBillingRow[] = [];
  function walk(node: OperationalBillingRow) {
    for (const child of node.children) {
      descendants.push(child);
      walk(child);
    }
  }
  walk(row);
  return descendants;
}

export function collectSubtreeSelection(row: OperationalBillingRow): OperationalSelectionState {
  const selection = createEmptySelection();
  function walk(node: OperationalBillingRow) {
    addRowToSelection(selection, node);
    for (const child of node.children) walk(child);
  }
  walk(row);
  return selection;
}

export function collectSelectableSubtreeSelection(
  row: OperationalBillingRow
): OperationalSelectionState {
  const selection = createEmptySelection();
  function walk(node: OperationalBillingRow) {
    for (const child of node.children) walk(child);
    if (isOperationalRowUiSelectable(node)) {
      addRowToSelection(selection, node);
    }
  }
  walk(row);
  return selection;
}

export function getSelectableDescendantRows(
  row: OperationalBillingRow
): OperationalBillingRow[] {
  return getDescendantRows(row).filter((descendant) =>
    isOperationalRowUiSelectable(descendant)
  );
}

function applySelectionMutation(
  target: OperationalSelectionState,
  mutation: OperationalSelectionState,
  mode: "add" | "remove"
): void {
  for (const id of mutation.line_ids) {
    if (mode === "add") target.line_ids.add(id);
    else target.line_ids.delete(id);
  }
  for (const id of mutation.deliverable_ids) {
    if (mode === "add") target.deliverable_ids.add(id);
    else target.deliverable_ids.delete(id);
  }
  for (const id of mutation.post_ids) {
    if (mode === "add") target.post_ids.add(id);
    else target.post_ids.delete(id);
  }
}

export function findRowPath(
  rows: OperationalBillingRow[],
  targetId: string
): OperationalBillingRow[] | null {
  for (const row of rows) {
    if (row.id === targetId) return [row];
    for (const child of row.children) {
      const childPath = findRowPath([child], targetId);
      if (childPath) return [row, ...childPath];
    }
  }
  return null;
}

function pruneAncestorSelections(
  selection: OperationalSelectionState,
  row: OperationalBillingRow,
  rootRows: OperationalBillingRow[]
): void {
  const path = findRowPath(rootRows, row.id);
  if (!path || path.length < 2) return;

  for (let index = path.length - 2; index >= 0; index -= 1) {
    const ancestor = path[index];
    const descendants = getDescendantRows(ancestor);
    const allDescendantsSelected =
      descendants.length > 0 &&
      descendants.every((descendant) => isRowDirectlySelected(descendant, selection));

    if (!allDescendantsSelected) {
      removeRowFromSelection(selection, ancestor);
    }
  }
}

export function getRowSelectionStatus(
  row: OperationalBillingRow,
  selection: OperationalSelectionState
): RowSelectionStatus {
  const descendants = getSelectableDescendantRows(row);
  const rowSelectable = isOperationalRowUiSelectable(row);

  if (descendants.length === 0) {
    if (!rowSelectable) return "unchecked";
    return isRowDirectlySelected(row, selection) ? "checked" : "unchecked";
  }

  const selectedDescendants = descendants.filter((descendant) =>
    isRowDirectlySelected(descendant, selection)
  ).length;
  const selfSelected = rowSelectable && isRowDirectlySelected(row, selection);

  if (selectedDescendants === 0 && !selfSelected) return "unchecked";
  if (selectedDescendants === descendants.length && (selfSelected || !rowSelectable)) {
    return "checked";
  }
  if (selectedDescendants === descendants.length && descendants.length > 0) return "checked";
  return "indeterminate";
}

export function isRowEffectivelySelected(
  row: OperationalBillingRow,
  selection: OperationalSelectionState,
  rootRows: OperationalBillingRow[]
): boolean {
  if (isRowDirectlySelected(row, selection)) return true;
  const path = findRowPath(rootRows, row.id);
  if (!path) return false;
  for (const ancestor of path.slice(0, -1)) {
    if (isRowDirectlySelected(ancestor, selection)) return true;
  }
  return false;
}

/** Toggle a row and cascade selection to all descendants; works when hierarchy is collapsed. */
function pruneMixedAssignmentSelection(
  selection: OperationalSelectionState,
  row: OperationalBillingRow,
  rootRows: OperationalBillingRow[]
): void {
  const path = findRowPath(rootRows, row.id);
  if (!path || path.length === 0) return;

  const assignment = path[0];
  const pricingMode = assignment.pricing_mode ?? "package";

  if (pricingMode === "package") {
    for (const descendant of getDescendantRows(assignment)) {
      removeRowFromSelection(selection, descendant);
    }
    return;
  }

  removeRowFromSelection(selection, assignment);
}

export function toggleOperationalRowSelection(
  row: OperationalBillingRow,
  selection: OperationalSelectionState,
  rootRows: OperationalBillingRow[]
): OperationalSelectionState {
  const canSelect =
    isOperationalRowUiSelectable(row) || getSelectableDescendantRows(row).length > 0;
  if (!canSelect) return selection;

  const next = cloneSelection(selection);
  const status = getRowSelectionStatus(row, selection);
  const selecting = status !== "checked";
  const subtree = collectSelectableSubtreeSelection(row);

  applySelectionMutation(next, subtree, selecting ? "add" : "remove");

  if (selecting) {
    pruneMixedAssignmentSelection(next, row, rootRows);
  } else {
    pruneAncestorSelections(next, row, rootRows);
  }

  return next;
}

/** One invoice batch payload — preserves explicit ids for server resolution. */
export function buildInvoiceSelectionBatch(
  selection: OperationalSelectionState,
  _rootRows?: OperationalBillingRow[]
): OperationalSelectionPayload {
  return selectionToPayload(selection);
}

/** Select all operational rows in the provided tree (assignments, deliverables, posts). */
export function selectAllOperationalRows(
  rows: OperationalBillingRow[]
): OperationalSelectionState {
  const selection = createEmptySelection();
  for (const row of rows) {
    applySelectionMutation(selection, collectSelectableSubtreeSelection(row), "add");
  }

  return selection;
}

export function clearOperationalSelection(): OperationalSelectionState {
  return createEmptySelection();
}

export function getGlobalSelectionStatus(
  rows: OperationalBillingRow[],
  selection: OperationalSelectionState
): RowSelectionStatus {
  const selectableRoots = rows.filter(
    (row) =>
      isOperationalRowUiSelectable(row) || getSelectableDescendantRows(row).length > 0
  );
  if (selectableRoots.length === 0) return "unchecked";
  const statuses = selectableRoots.map((row) => getRowSelectionStatus(row, selection));
  if (statuses.every((status) => status === "checked")) return "checked";
  if (statuses.every((status) => status === "unchecked")) return "unchecked";
  return "indeterminate";
}

export function toggleGlobalOperationalSelection(
  rows: OperationalBillingRow[],
  selection: OperationalSelectionState
): OperationalSelectionState {
  const status = getGlobalSelectionStatus(rows, selection);
  if (status === "checked") {
    return clearOperationalSelection();
  }
  return selectAllOperationalRows(rows);
}
