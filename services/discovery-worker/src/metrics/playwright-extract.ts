import { fetchPublicHtml } from "../browser/browser-pool.js";
import { extractPublicationDateFromHtml } from "@/lib/performance/metrics-collector/extract-publication-date";

function parseCompactCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/,/g, "");
  const match = cleaned.match(/^([\d.]+)([kmb])?$/);
  if (!match) {
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = match[2];
  if (suffix === "k") return Math.round(base * 1_000);
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "b") return Math.round(base * 1_000_000_000);
  return Math.round(base);
}

function firstCount(html: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const value = parseCompactCount(match?.[1]);
    if (value != null) return value;
  }
  return null;
}

export async function extractPostMetricsWithPlaywright(
  url: string,
  platform: string
): Promise<Record<string, number | null> & { publicationDate?: string | null }> {
  const html = await fetchPublicHtml(url);
  const publicationDate = extractPublicationDateFromHtml(platform, html);

  if (platform === "instagram") {
    return {
      views: firstCount(html, [
        /"video_view_count"\s*:\s*(\d+)/,
        /"play_count"\s*:\s*(\d+)/,
      ]),
      likes: firstCount(html, [/"edge_liked_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/, /"like_count"\s*:\s*(\d+)/]),
      comments: firstCount(html, [/"edge_media_to_comment"\s*:\s*\{\s*"count"\s*:\s*(\d+)/, /"comment_count"\s*:\s*(\d+)/]),
      publicationDate,
    };
  }

  if (platform === "tiktok") {
    return {
      views: firstCount(html, [/"playCount"\s*:\s*(\d+)/, /"play_count"\s*:\s*(\d+)/]),
      likes: firstCount(html, [/"diggCount"\s*:\s*(\d+)/]),
      comments: firstCount(html, [/"commentCount"\s*:\s*(\d+)/]),
      shares: firstCount(html, [/"shareCount"\s*:\s*(\d+)/]),
      publicationDate,
    };
  }

  if (platform === "youtube") {
    return {
      views: firstCount(html, [/"viewCount"\s*:\s*"(\d+)"/, /"viewCount"\s*:\s*(\d+)/]),
      likes: firstCount(html, [/"likeCount"\s*:\s*"(\d+)"/, /"likeCount"\s*:\s*(\d+)/]),
      comments: firstCount(html, [/"commentCount"\s*:\s*"(\d+)"/]),
      publicationDate,
    };
  }

  return {
    views: firstCount(html, [/([\d,.]+[kmb]?)\s+views/i]),
    likes: firstCount(html, [/([\d,.]+[kmb]?)\s+likes/i]),
    publicationDate,
  };
}
