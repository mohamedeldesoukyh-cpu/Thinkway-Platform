import type { CreatorRecentPublication } from "@/lib/creators/types";
import { pickApifyPreviewImageUrl } from "@/lib/performance/apify-preview-image";
import {
  SOCIAL_MEDIA_SRC_ALLOWLIST,
  isUrlAllowedByHostlist,
} from "@/lib/security/ssrf";

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

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when a publication preview should be loaded via the server proxy (social CDNs). */
export function shouldProxyPublicationMediaUrl(url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  if (host === "supabase.co" || host.endsWith(".supabase.co")) return false;
  if (host === "supabase.in" || host.endsWith(".supabase.in")) return false;
  return isUrlAllowedByHostlist(url, SOCIAL_MEDIA_SRC_ALLOWLIST);
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

export function recentPublicationsLackThumbnails(publications: unknown): boolean {
  if (!Array.isArray(publications) || publications.length === 0) return false;
  return publications.every(
    (pub) => !resolveCreatorRecentPublicationThumbnail(pub as Record<string, unknown>)
  );
}

/** Browser-safe preview URL — proxies expiring Instagram/TikTok CDN links server-side. */
export function creatorRecentPublicationDisplayUrl(
  publication: CreatorRecentPublication | Record<string, unknown> | null | undefined
): string | null {
  if (!publication || typeof publication !== "object") return null;
  const row = publication as Record<string, unknown>;
  const thumbnail = resolveCreatorRecentPublicationThumbnail(publication);
  const postUrl =
    str(row.url) ?? str(row.postPage) ?? str(row.webVideoUrl) ?? str(row.content_url) ?? null;

  if (!thumbnail && !postUrl) return null;
  if (thumbnail && !shouldProxyPublicationMediaUrl(thumbnail)) return thumbnail;

  const params = new URLSearchParams();
  if (thumbnail) params.set("src", thumbnail);
  if (postUrl) params.set("postUrl", postUrl);
  return `/api/creators/publication-preview?${params.toString()}`;
}

function isTikTokPublicationHost(host: string): boolean {
  return host.includes("tiktok.com");
}

/** True when a publication permalink points at video content (reels, TikTok, YouTube, etc.). */
export function isVideoPublicationUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (host.includes("instagram.com")) {
      const first = segments[0];
      return first === "reel" || first === "reels" || first === "tv";
    }

    if (isTikTokPublicationHost(host)) {
      // vm.tiktok.com / vt.tiktok.com short links always resolve to a video.
      if (host.startsWith("vm.") || host.startsWith("vt.")) return segments.length > 0;
      if (segments.includes("video") || segments[0] === "t") return true;
      const last = segments[segments.length - 1] ?? "";
      return /^\d{8,}$/.test(last);
    }

    if (host.includes("youtube.com") || host.includes("youtu.be") || host.includes("m.youtube.com")) {
      if (host.includes("youtu.be")) return Boolean(segments[0]);
      const first = segments[0];
      if (first === "shorts" || first === "watch" || first === "embed" || first === "live") {
        return true;
      }
      return parsed.searchParams.has("v");
    }

    if (host.includes("facebook.com") || host.includes("fb.watch") || host.includes("fb.com")) {
      if (host.includes("fb.watch")) return Boolean(segments[0]);
      const first = segments[0];
      if (first === "reel" || first === "reels" || first === "watch") return true;
      return segments.includes("videos") || segments.includes("video");
    }

    if (host.includes("snapchat.com") && segments[0] === "spotlight") return true;

    return false;
  } catch {
    return false;
  }
}

export function isCreatorRecentPublicationVideo(
  publication: CreatorRecentPublication | Record<string, unknown> | null | undefined
): boolean {
  if (!publication || typeof publication !== "object") return false;
  const row = publication as Record<string, unknown>;

  if (row.isVideo === true) return true;

  if (str(row.webVideoUrl)) return true;

  const videoUrl = str(row.videoUrl) ?? str(row.video_url);
  if (videoUrl) return true;

  const type = str(row.type)?.toLowerCase();
  if (type === "video" || type === "reel" || type === "clips") return true;

  const productType = str(row.product_type)?.toLowerCase();
  if (productType === "clips" || productType === "reels" || productType === "igtv") return true;

  const mediaType = str(row.mediaType)?.toLowerCase() ?? str(row.media_type)?.toLowerCase();
  if (mediaType === "video" || mediaType === "reel" || mediaType === "carousel_video") {
    return true;
  }
  if (num(row.mediaType) === 2 || num(row.media_type) === 2) return true;

  const views =
    num(row.views) ??
    num(row.videoViewCount) ??
    num(row.playCount) ??
    num(row.videoPlayCount);
  if (views != null && views > 0) return true;

  const url =
    str(row.url) ?? str(row.postPage) ?? str(row.webVideoUrl) ?? str(row.content_url) ?? null;
  return isVideoPublicationUrl(url);
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
        isVideo: isCreatorRecentPublicationVideo(row),
      };
    })
    .filter((pub): pub is CreatorRecentPublication => pub != null);
}
