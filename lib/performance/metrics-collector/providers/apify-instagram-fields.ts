import { sanitizeMetricValue } from "@/lib/performance/metrics-collector/merge-metrics";

function num(value: unknown): number | null {
  return sanitizeMetricValue(value);
}

function nestedCount(value: unknown): number | null {
  if (value == null || typeof value !== "object") return null;
  if ("count" in value) return num((value as { count: unknown }).count);
  return null;
}

/** Instagram-specific Apify field extraction with hidden-likes fallbacks. */
export function mapApifyInstagramMetrics(row: Record<string, unknown>) {
  return {
    views: num(
      row.videoPlayCount ??
        row.videoViewCount ??
        row.playCount ??
        row.viewCount ??
        row.views ??
        row.play_count
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
    shares: num(row.sharesCount ?? row.shares ?? row.shareCount),
    saves: num(row.savesCount ?? row.saves ?? row.saveCount),
    impressions: num(row.impressions),
    reach: num(row.reach),
  };
}
