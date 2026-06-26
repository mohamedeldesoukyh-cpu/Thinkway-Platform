import { mapApifyInstagramMetrics } from "@/lib/performance/metrics-collector/providers/apify-instagram-fields";
import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";
import type { CollectedMetrics } from "@/lib/performance/metrics-collector/types";

function num(value: unknown): number | null {
  return sanitizeMetricValue(value);
}

function apifyRowHasError(row: Record<string, unknown>): boolean {
  if (row.error || row.errorDescription) return true;
  if (typeof row.message === "string" && /not found|private|unavailable/i.test(row.message)) {
    return true;
  }
  return false;
}

export function mapApifyPayloadToMetrics(
  platform: string,
  payload: unknown
): Partial<CollectedMetrics> | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;

  if (apifyRowHasError(row)) return null;

  if (platform === "tiktok") {
    return {
      views: num(row.playCount ?? row.views ?? row.videoPlayCount ?? row.play_count),
      likes: num(row.diggCount ?? row.likes ?? row.heartCount ?? row.heart),
      comments: num(row.commentCount ?? row.comments),
      shares: num(row.shareCount ?? row.shares),
      saves: num(row.collectCount ?? row.saves ?? row.bookmarkCount),
    };
  }

  if (platform === "youtube") {
    return {
      views: num(row.viewCount ?? row.views ?? row.playCount),
      likes: num(row.likes ?? row.likeCount ?? row.numberOfLikes),
      comments: num(row.commentsCount ?? row.numberOfComments ?? row.commentCount),
      shares: num(row.shares ?? row.shareCount),
    };
  }

  if (platform === "facebook") {
    return {
      views: num(row.videoViewCount ?? row.viewCount ?? row.views ?? row.playCount),
      likes: num(row.likesCount ?? row.likes ?? row.reactionCount ?? row.reactions),
      comments: num(row.commentsCount ?? row.comments ?? row.commentCount),
      shares: num(row.sharesCount ?? row.shares ?? row.shareCount),
      impressions: num(row.impressions),
      reach: num(row.reach),
    };
  }

  if (platform === "snapchat") {
    return {
      views: num(row.viewCount ?? row.views ?? row.playCount ?? row.view_count),
      likes: num(row.likesCount ?? row.likes ?? row.favoriteCount),
      comments: num(row.commentsCount ?? row.comments),
      shares: num(row.sharesCount ?? row.shares),
    };
  }

  if (platform === "instagram") {
    return mapApifyInstagramMetrics(row);
  }

  return {
    views: num(
      row.videoPlayCount ??
        row.videoViewCount ??
        row.playCount ??
        row.viewCount ??
        row.videoViewCount ??
        row.views ??
        row.viewCount
    ),
    likes: num(
      row.likesCount ??
        nestedCount(row.edge_media_preview_like) ??
        row.likes ??
        row.likeCount
    ),
    comments: num(
      row.commentsCount ??
        row.comments ??
        row.commentCount ??
        nestedCount(row.edge_media_to_comment)
    ),
    shares: num(row.sharesCount ?? row.shares),
    saves: num(row.savesCount ?? row.saves),
    impressions: num(row.impressions),
    reach: num(row.reach),
  };
}

function nestedCount(value: unknown): number | null {
  if (value == null || typeof value !== "object") return null;
  if ("count" in value) return num((value as { count: unknown }).count);
  return null;
}
