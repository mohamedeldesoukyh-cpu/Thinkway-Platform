/**
 * Extract preview/thumbnail image URL from Apify Instagram/TikTok scraper payloads.
 * Instagram `apify/instagram-scraper` returns `displayUrl` (image/reel poster).
 */
export function pickApifyPreviewImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;

  const directCandidates = [
    row.displayUrl,
    row.display_url,
    row.thumbnailUrl,
    row.thumbnail_url,
    row.thumbnail,
    row.cover,
    row.coverUrl,
    row.imageUrl,
    row.image_url,
    row.previewUrl,
    row.preview_url,
  ];

  for (const value of directCandidates) {
    if (typeof value === "string" && value.startsWith("http")) return value;
  }

  const images = row.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      if (typeof item === "string" && item.startsWith("http")) return item;
      if (item && typeof item === "object") {
        const nested = item as Record<string, unknown>;
        const url =
          (typeof nested.url === "string" && nested.url) ||
          (typeof nested.src === "string" && nested.src) ||
          null;
        if (url?.startsWith("http")) return url;
      }
    }
  }

  const childPosts = row.childPosts;
  if (Array.isArray(childPosts) && childPosts[0]) {
    return pickApifyPreviewImageUrl(childPosts[0]);
  }

  return null;
}
