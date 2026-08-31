import type { CreatorRecentPublication } from "@/lib/creators/types";
import {
  pickApifyPreviewImageUrl,
  pickApifyTikTokCoverUrls,
} from "@/lib/performance/apify-preview-image";
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

/** Instagram/Facebook CDN thumbs at 150–480px look pixelated when stretched in Showcase. */
const LOW_RES_CDN_SIZE =
  /\bs(?:[1-9]\d|[1-3]\d{2}|4[0-7]\d)x(?:[1-9]\d|[1-3]\d{2}|4[0-7]\d)\b/i;

export function isLikelyLowResolutionSocialThumb(url: string): boolean {
  try {
    const parsed = new URL(url);
    const haystack = `${parsed.pathname}${parsed.search}`;
    if (LOW_RES_CDN_SIZE.test(haystack)) return true;
    if (/\/s\d{2,3}x\d{2,3}\//i.test(parsed.pathname)) return true;
    if (/_s\.(jpe?g|png|webp)$/i.test(parsed.pathname)) return true;
    if (/_(?:150|240|320)x(?:150|240|320)\b/i.test(haystack)) return true;
    const stp = parsed.searchParams.get("stp") ?? "";
    if (LOW_RES_CDN_SIZE.test(stp) || /(?:^|[_\-])s(?:150|240|320)x/i.test(stp)) return true;
    return false;
  } catch {
    return false;
  }
}

function rewriteSocialCdnSizeTokens(url: string, target: number): string {
  try {
    const parsed = new URL(url);
    const replaceSize = (value: string) =>
      value.replace(/\bs(\d{2,4})x(\d{2,4})\b/gi, (_, width, height) => {
        const size = Math.max(Number(width), Number(height));
        return size >= target ? `s${width}x${height}` : `s${target}x${target}`;
      });
    parsed.pathname = replaceSize(parsed.pathname);
    parsed.search = replaceSize(parsed.search);
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Ask the CDN for a larger derivative when the stored thumb is a 150/320 crop. */
export function preferHigherResolutionSocialImageUrl(url: string): string {
  return rewriteSocialCdnSizeTokens(url, 1080);
}

/** Larger unsigned CDN sizes to try before the stored thumb (1080 often 403s; 640/320 may work). */
export function higherResolutionSocialImageUrlCandidates(url: string): string[] {
  const out: string[] = [];
  for (const target of [1080, 640, 320] as const) {
    const next = rewriteSocialCdnSizeTokens(url, target);
    if (next !== url && !out.includes(next)) out.push(next);
  }
  return out;
}

/** Signed Instagram/TikTok CDN URLs 403 when the size token is rewritten. */
export function socialCdnUrlLooksSigned(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has("oh") ||
      parsed.searchParams.has("oe") ||
      parsed.searchParams.has("_nc_ohc") ||
      parsed.searchParams.has("x-signature") ||
      parsed.searchParams.has("x-expires")
    );
  } catch {
    return false;
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

/** Instagram profile-pic folder, TikTok avatar objects, or explicit profile_pic paths. */
export function isLikelyCreatorProfileImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const haystack = `${parsed.pathname}${parsed.search}`.toLowerCase();
    if (haystack.includes("t51.2885-19")) return true;
    if (haystack.includes("profile_pic") || haystack.includes("profile-pic")) return true;
    if (haystack.includes("profile_picture") || haystack.includes("profile-picture")) return true;
    if (/[-_/]avt[-_/]/.test(haystack)) return true;
    return false;
  } catch {
    return false;
  }
}

/** Playwright / stored screenshot object — not the publication's own media. */
export function isLikelyPublicationScreenshotUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();
    if (path.includes("/screenshot.") || path.includes("/screenshots/")) return true;
    if (/\/screenshot\.(jpe?g|png|webp)$/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

type PublicationImageFieldRank = {
  value: unknown;
  rank: number;
};

function finalizePublicationImageUrl(url: string): string {
  if (!socialCdnUrlLooksSigned(url) && isLikelyLowResolutionSocialThumb(url)) {
    return preferHigherResolutionSocialImageUrl(url);
  }
  return url;
}

function scorePublicationImageCandidate(url: string, fieldRank: number): number {
  if (!url.startsWith("http")) return Number.NEGATIVE_INFINITY;
  if (isLikelyCreatorProfileImageUrl(url)) return Number.NEGATIVE_INFINITY;
  let score = fieldRank;
  if (isLikelyPublicationScreenshotUrl(url)) score -= 40;
  if (isLikelyLowResolutionSocialThumb(url)) score -= 20;
  return score;
}

/** Resolve a displayable thumbnail from normalized or raw Apify publication rows. */
export function resolveCreatorRecentPublicationThumbnail(
  publication: CreatorRecentPublication | Record<string, unknown> | null | undefined
): string | null {
  if (!publication || typeof publication !== "object") return null;
  const row = publication as Record<string, unknown>;
  const displayResource = record(row.displayResource);

  const fields: PublicationImageFieldRank[] = [
    { value: row.displayUrl, rank: 80 },
    { value: row.display_url, rank: 80 },
    { value: row.fullPicture, rank: 78 },
    { value: row.full_picture, rank: 78 },
    { value: row.originalCoverUrl, rank: 76 },
    { value: row.coverUrl, rank: 70 },
    { value: row.imageUrl, rank: 68 },
    { value: row.image_url, rank: 68 },
    { value: row.previewUrl, rank: 60 },
    { value: row.preview_url, rank: 60 },
    { value: row.thumbnailUrl, rank: 45 },
    { value: row.thumbnail_url, rank: 45 },
    { value: row.thumbnailSrc, rank: 42 },
    { value: row.thumbnail, rank: 40 },
    { value: displayResource?.src, rank: 55 },
    { value: row.cover, rank: 38 },
    { value: row.screenshot_url, rank: 8 },
  ];

  let bestUrl: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  const consider = (raw: unknown, fieldRank: number) => {
    const url = str(raw);
    if (!url?.startsWith("http")) return;
    const score = scorePublicationImageCandidate(url, fieldRank);
    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  };

  for (const field of fields) {
    consider(field.value, field.rank);
  }

  for (const cover of pickApifyTikTokCoverUrls(row)) {
    consider(cover, 74);
  }

  if (bestUrl && Number.isFinite(bestScore)) {
    return finalizePublicationImageUrl(bestUrl);
  }

  const nested = pickApifyPreviewImageUrl(row);
  if (nested?.startsWith("http")) {
    const score = scorePublicationImageCandidate(nested, 50);
    if (Number.isFinite(score)) return finalizePublicationImageUrl(nested);
  }

  return null;
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
