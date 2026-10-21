import { resolveCanonicalCategory } from "@/lib/creator-intelligence/taxonomy";

export function refreshedManualCategories(manual: string[], provider: string[]): string[] {
  const actual = [...new Set(provider.map(resolveCanonicalCategory).filter((v): v is string => Boolean(v)))];
  if (!actual.length) return manual;
  return [...new Set([...actual, ...manual.filter(v => ["PR", "UGC"].includes(v.trim().toUpperCase())).map(v => v.trim().toUpperCase())])];
}
