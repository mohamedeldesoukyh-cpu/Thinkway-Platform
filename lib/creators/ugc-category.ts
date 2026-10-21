export function hasUgcCategory(categories?: readonly string[] | null): boolean {
  return (categories ?? []).some((value) => value.trim().toUpperCase() === "UGC");
}

export function toggleUgcCategory(categories: readonly string[], enabled: boolean): string[] {
  const other = categories.filter((value) => value.trim().toUpperCase() !== "UGC");
  return enabled ? ["UGC", ...other] : other;
}
