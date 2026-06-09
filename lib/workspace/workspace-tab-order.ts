/** Merge saved order with default — drops unknown ids and appends any new tabs. */
export function normalizeWorkspaceTabOrder<T extends string>(
  saved: unknown,
  defaultOrder: readonly T[],
  isValidId: (id: string) => id is T
): T[] {
  const parsed = Array.isArray(saved)
    ? saved.filter((id): id is T => typeof id === "string" && isValidId(id))
    : [];

  const seen = new Set<T>();
  const ordered: T[] = [];

  for (const id of parsed) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }

  for (const id of defaultOrder) {
    if (!seen.has(id)) ordered.push(id);
  }

  return ordered;
}

export function reorderWorkspaceTabs<T extends string>(
  order: readonly T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= order.length ||
    toIndex >= order.length
  ) {
    return [...order];
  }

  const next = [...order];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
