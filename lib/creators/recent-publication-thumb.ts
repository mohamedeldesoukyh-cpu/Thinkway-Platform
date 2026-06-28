import type { CreatorRecentPublication } from "@/lib/creators/types";
import { pickApifyPreviewImageUrl } from "@/lib/performance/apify-preview-image";

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Resolve a displayable thumbnail from normalized or raw Apify publication rows. */
export function resolveCreatorRecentPublicationThumbnail(
  publication: CreatorRecentPublication | Record<string, unknown> | null | undefined
): string | null {
  if (!publication || typeof publication !== "object") return null;
  const row = publication as Record<string, unknown>;
  const displayResource = record(row.displayResource);

  const direct =
    str(row.thumbnail) ??
    str(row.thumbnailSrc) ??
    str(row.displayUrl) ??
    str(row.display_url) ??
    str(row.imageUrl) ??
    str(row.image_url) ??
    str(row.previewUrl) ??
    str(row.preview_url) ??
    str(row.thumbnailUrl) ??
    str(row.thumbnail_url) ??
    str(displayResource?.src) ??
    str(row.coverUrl) ??
    str(row.cover) ??
    str(row.screenshot_url) ??
    null;

  if (direct?.startsWith("http")) return direct;
  return pickApifyPreviewImageUrl(row);
}

/** Normalize DB / Apify JSONB into stable CreatorRecentPublication rows for UI. */
export function normalizeCreatorRecentPublications(
  publications: unknown
): CreatorRecentPublication[] {
  if (!Array.isArray(publications)) return [];

  return publications
    .map((raw): CreatorRecentPublication | null => {
      if (!raw || typeof raw !== "object") return null;
      const row = raw as Record<string, unknown>;
      const thumbnail = resolveCreatorRecentPublicationThumbnail(row);
      const url =
        str(row.url) ?? str(row.postPage) ?? str(row.webVideoUrl) ?? str(row.content_url) ?? null;
      const caption = str(row.caption) ?? str(row.text) ?? null;
      const posted_at =
        str(row.posted_at) ?? str(row.timestamp) ?? str(row.createTimeISO) ?? null;

      if (!url && !caption && thumbnail == null && num(row.likes) == null && num(row.comments) == null) {
        return null;
      }

      return {
        url,
        thumbnail,
        likes: num(row.likes) ?? num(row.likesCount) ?? num(row.diggCount),
        comments: num(row.comments) ?? num(row.commentsCount),
        views: num(row.views) ?? num(row.videoViewCount) ?? num(row.playCount),
        posted_at,
        caption,
      };
    })
    .filter((pub): pub is CreatorRecentPublication => pub != null);
}
