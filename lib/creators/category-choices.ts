/** Preserve category labels while treating casing and repeated spaces as duplicates. */
export function normalizeCreatorCategoryChoices(values: readonly string[]): string[] {
  const choices = new Map<string, string>();
  for (const value of values) {
    const label = value.trim().replace(/\s+/g, " ");
    if (label && !choices.has(label.toLowerCase())) choices.set(label.toLowerCase(), label);
  }
  return [...choices.values()];
}
