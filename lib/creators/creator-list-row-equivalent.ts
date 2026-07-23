import type { UnifiedCreatorResult } from "@/lib/creators/types";

/** Skip list/detail churn when a patch does not change row-visible creator data. */
export function creatorListRowEquivalent(
  current: UnifiedCreatorResult,
  next: UnifiedCreatorResult
): boolean {
  if (current.unified_id !== next.unified_id) return false;
  if (current.display_name !== next.display_name) return false;
  if (current.enrichment_status !== next.enrichment_status) return false;
  if (current.thinkway_score !== next.thinkway_score) return false;
  if (current.primaryAvatarUrl !== next.primaryAvatarUrl) return false;
  if (
    current.default_metrics_platform_account_id !== next.default_metrics_platform_account_id
  ) {
    return false;
  }
  if (current.platforms.length !== next.platforms.length) return false;

  const currentPlatformIds = current.platforms.map((platform) => platform.id).sort();
  const nextPlatformIds = next.platforms.map((platform) => platform.id).sort();
  for (let index = 0; index < currentPlatformIds.length; index += 1) {
    if (currentPlatformIds[index] !== nextPlatformIds[index]) return false;
  }

  for (const left of current.platforms) {
    const right = next.platforms.find((platform) => platform.id === left.id);
    if (!right) return false;
    if (
      left.platform !== right.platform ||
      left.handle !== right.handle ||
      left.follower_count !== right.follower_count ||
      left.engagement_rate !== right.engagement_rate ||
      left.avg_views !== right.avg_views
    ) {
      return false;
    }
  }

  return true;
}
