/** Ordered shortlist item IDs: first starred is recommendation 1. */
export function readRecommendationIds(metadata: unknown): string[] {
  const value = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).recommendedCreatorIds : undefined;
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
}
export function recommendationRank(metadata: unknown, itemId: string): number | undefined {
  const index = readRecommendationIds(metadata).indexOf(itemId);
  return index < 0 ? undefined : index + 1;
}
export function compareRecommendations(a: { recommendationRank?: number }, b: { recommendationRank?: number }) {
  return (a.recommendationRank ?? Number.MAX_SAFE_INTEGER) - (b.recommendationRank ?? Number.MAX_SAFE_INTEGER);
}
