import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function nestedCount(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && "count" in (value as object)) {
    return sanitizeMetricValue((value as { count: unknown }).count);
  }
  return sanitizeMetricValue(value);
}

/**
 * Extract creator follower count from Apify post-scraper payloads when available.
 * TikTok: authorMeta.fans. Instagram post actor typically omits owner follower stats.
 */
export function pickApifyAuthorFollowerCount(
  platform: string,
  payload: unknown
): number | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const platformKey = canonicalPlatformKey(platform);

  if (platformKey === "tiktok") {
    const authorMeta = nestedRecord(row.authorMeta);
    const author = nestedRecord(row.author);
    return (
      sanitizeMetricValue(authorMeta?.fans) ??
      sanitizeMetricValue(authorMeta?.followerCount) ??
      sanitizeMetricValue(author?.fans) ??
      sanitizeMetricValue(author?.followerCount) ??
      sanitizeMetricValue(row.authorFans)
    );
  }

  if (platformKey === "instagram") {
    const owner = nestedRecord(row.owner);
    const author = nestedRecord(row.author);
    return (
      sanitizeMetricValue(row.ownerFollowersCount) ??
      sanitizeMetricValue(row.ownerFollowers) ??
      sanitizeMetricValue(owner?.followersCount) ??
      sanitizeMetricValue(owner?.followerCount) ??
      nestedCount(owner?.edge_followed_by) ??
      sanitizeMetricValue(author?.followersCount) ??
      sanitizeMetricValue(author?.followerCount)
    );
  }

  if (platformKey === "youtube") {
    const channel = nestedRecord(row.channel);
    return (
      sanitizeMetricValue(row.numberOfSubscribers) ??
      sanitizeMetricValue(row.subscriberCount) ??
      sanitizeMetricValue(channel?.subscriberCount) ??
      sanitizeMetricValue(channel?.numberOfSubscribers)
    );
  }

  if (platformKey === "facebook") {
    return (
      sanitizeMetricValue(row.followers) ??
      sanitizeMetricValue(row.followerCount) ??
      sanitizeMetricValue(row.followersCount) ??
      sanitizeMetricValue(row.pageFollowers)
    );
  }

  if (platformKey === "snapchat") {
    return (
      sanitizeMetricValue(row.subscriberCount) ??
      sanitizeMetricValue(row.subscribers) ??
      sanitizeMetricValue(row.followerCount) ??
      sanitizeMetricValue(row.followersCount)
    );
  }

  const author = nestedRecord(row.author);
  return (
    sanitizeMetricValue(row.followerCount) ??
    sanitizeMetricValue(row.followersCount) ??
    sanitizeMetricValue(author?.followerCount) ??
    sanitizeMetricValue(author?.followersCount)
  );
}
