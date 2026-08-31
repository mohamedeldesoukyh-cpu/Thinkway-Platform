/**
 * Extract preview/thumbnail image URL from Apify Instagram/TikTok scraper payloads.
 * Instagram `apify/instagram-scraper` returns `displayUrl` (image/reel poster).
 * TikTok `clockworks/tiktok-scraper` nests covers under `videoMeta` / `covers`.
 */

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.startsWith("http") ? trimmed : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** TikTok post rows store cover art under nested videoMeta / covers objects. */
export function pickApifyTikTokCoverUrls(row: Record<string, unknown>): string[] {
  const urls: string[] = [];

  const push = (value: unknown) => {
    const url = httpUrl(value);
    if (url) urls.push(url);
  };

  const videoMeta = record(row.videoMeta);
  if (videoMeta) {
    push(videoMeta.originalCoverUrl);
    push(videoMeta.coverUrl);
    push(videoMeta.dynamicCover);
    push(videoMeta.cover);
  }

  const covers = record(row.covers);
  if (covers) {
    push(covers.origin);
    push(covers.default);
    push(covers.dynamic);
  }

  push(row.originalCoverUrl);
  push(row.dynamicCover);
  push(row.coverUrl);
  push(row.cover);

  return urls;
}

export function pickApifyPreviewImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;

  const displayResource = record(row.displayResource);

  const media = record(row.media);
  const mediaImage = media ? record(media.image) : null;
  const photoImage = record(row.photo_image);
  const imageObj = record(row.image);

  const directCandidates = [
    row.displayUrl,
    row.display_url,
    row.fullPicture,
    row.full_picture,
    row.originalCoverUrl,
    row.thumbnailSrc,
    row.thumbnailUrl,
    row.thumbnail_url,
    row.thumbnail,
    row.cover,
    row.coverUrl,
    row.imageUrl,
    row.image_url,
    row.previewUrl,
    row.preview_url,
    displayResource?.src,
    mediaImage?.uri,
    mediaImage?.url,
    photoImage?.uri,
    photoImage?.url,
    imageObj?.uri,
    imageObj?.url,
  ];

  for (const value of directCandidates) {
    const url = httpUrl(value);
    if (url) return url;
  }

  const tiktokCover = pickApifyTikTokCoverUrls(row)[0];
  if (tiktokCover) return tiktokCover;

  const images = row.images;
  if (Array.isArray(images)) {
    for (const item of images) {
      const url = httpUrl(item);
      if (url) return url;
      const nested = record(item);
      if (nested) {
        const nestedUrl = httpUrl(nested.url) ?? httpUrl(nested.src);
        if (nestedUrl) return nestedUrl;
      }
    }
  }

  const childPosts = row.childPosts;
  if (Array.isArray(childPosts) && childPosts[0]) {
    return pickApifyPreviewImageUrl(childPosts[0]);
  }

  return null;
}
