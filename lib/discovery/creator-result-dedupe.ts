import type { UnifiedCreatorResult } from "@/lib/creators/types";

function platformHandleKey(creator: UnifiedCreatorResult): string {
  const platform = creator.platforms[0]?.platform?.trim().toLowerCase() ?? "";
  const handle =
    creator.platforms[0]?.handle?.trim().toLowerCase().replace(/^@+/, "") ?? "";
  if (platform && handle) return `${platform}:${handle}`;
  return creator.unified_id;
}

/** Collapse duplicate platform handles — keeps the higher relevance / richer row. */
export function dedupeCreatorsByPlatformHandle(
  creators: UnifiedCreatorResult[]
): UnifiedCreatorResult[] {
  const best = new Map<string, UnifiedCreatorResult>();

  for (const creator of creators) {
    const key = platformHandleKey(creator);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, creator);
      continue;
    }

    const nextScore = creator.campaign_relevance_score ?? creator.thinkway_score ?? 0;
    const prevScore = existing.campaign_relevance_score ?? existing.thinkway_score ?? 0;
    const nextFollowers =
      creator.metrics.followers.value ?? creator.platforms[0]?.follower_count ?? 0;
    const prevFollowers =
      existing.metrics.followers.value ?? existing.platforms[0]?.follower_count ?? 0;

    if (
      nextScore > prevScore ||
      (nextScore === prevScore && nextFollowers > prevFollowers)
    ) {
      best.set(key, creator);
    }
  }

  return [...best.values()];
}
