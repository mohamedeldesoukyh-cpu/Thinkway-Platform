import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

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
  const descendants = getDescendantRows(row);
  if (descendants.length === 0) {
    return isRowDirectlySelected(row, selection) ? "checked" : "unchecked";
  }

  const selectedDescendants = descendants.filter((descendant) =>
    isRowDirectlySelected(descendant, selection)
  ).length;
  const selfSelected = isRowDirectlySelected(row, selection);

  if (selectedDescendants === 0 && !selfSelected) return "unchecked";
  if (selectedDescendants === descendants.length && selfSelected) return "checked";
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
export function toggleOperationalRowSelection(
  row: OperationalBillingRow,
  selection: OperationalSelectionState,
  rootRows: OperationalBillingRow[]
): OperationalSelectionState {
  const next = cloneSelection(selection);
  const status = getRowSelectionStatus(row, selection);
  const selecting = status !== "checked";
  const subtree = collectSubtreeSelection(row);

  applySelectionMutation(next, subtree, selecting ? "add" : "remove");

  if (!selecting) {
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
    applySelectionMutation(selection, collectSubtreeSelection(row), "add");
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
  if (rows.length === 0) return "unchecked";
  const statuses = rows.map((row) => getRowSelectionStatus(row, selection));
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
