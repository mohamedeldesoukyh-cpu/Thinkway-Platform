import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { isAvatarUrlAllowedForPlatform } from "@/lib/performance/creator-avatar";

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.startsWith("http") ? trimmed : null;
}

function firstHttpUrl(candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const url = httpUrl(candidate);
    if (url) return url;
  }
  return null;
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function tiktokAuthorAvatarCandidates(row: Record<string, unknown>): unknown[] {
  const authorMeta = nestedRecord(row.authorMeta);
  const author = nestedRecord(row.author);
  return [
    authorMeta?.originalAvatarUrl,
    authorMeta?.avatarLarger,
    authorMeta?.avatarMedium,
    authorMeta?.avatar,
    authorMeta?.avatarThumb,
    authorMeta?.profilePicture,
    authorMeta?.profilePictureUrl,
    authorMeta?.avatarUrl,
    author?.avatarLarger,
    author?.avatarMedium,
    author?.avatar,
    author?.avatarThumb,
    author?.originalAvatarUrl,
    author?.profilePictureUrl,
    author?.avatarUrl,
    row.authorAvatar,
    row.authorAvatarUrl,
    row.authorAvatarThumbUrl,
    row.authorProfilePicUrl,
    row.authorProfilePictureUrl,
    row.avatarThumb,
    row.avatarLarger,
  ];
}

function instagramAuthorAvatarCandidates(row: Record<string, unknown>): unknown[] {
  const owner = nestedRecord(row.owner);
  const author = nestedRecord(row.author);
  return [
    row.ownerProfilePicUrl,
    row.owner_profile_pic_url,
    owner?.profilePicUrl,
    owner?.profile_pic_url,
    owner?.profilePictureUrl,
    author?.profilePicUrl,
    author?.profile_pic_url,
    author?.profilePictureUrl,
    row.profilePicUrl,
    row.profile_pic_url,
  ];
}

function genericAuthorAvatarCandidates(row: Record<string, unknown>): unknown[] {
  const channel = nestedRecord(row.channel);
  const author = nestedRecord(row.author);
  return [
    row.channelAvatarUrl,
    row.channelAvatar,
    row.channelThumbnail,
    row.avatarUrl,
    channel?.avatarUrl,
    channel?.avatar,
    channel?.channelThumbnail,
    channel?.profileImageUrl,
    author?.avatarUrl,
    author?.avatar,
    author?.profileImageUrl,
    row.authorAvatarUrl,
    row.authorAvatar,
  ];
}

/**
 * Extract creator profile photo URL from Apify post-scraper payloads.
 * TikTok: clockworks/tiktok-scraper `authorMeta.avatar` / `originalAvatarUrl`.
 * Instagram: apify/instagram-scraper `ownerProfilePicUrl` and nested owner/author fields.
 */
/** Read authorAvatarUrl from a publication_metric_sync_logs.response_summary row. */
export function authorAvatarFromSyncLogSummary(summary: unknown): string | null {
  if (!summary || typeof summary !== "object") return null;
  const url = (summary as Record<string, unknown>).authorAvatarUrl;
  return typeof url === "string" && url.startsWith("http") ? url : null;
}

export function pickApifyAuthorAvatarUrl(
  platform: string,
  payload: unknown
): string | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;

  const platformKey = canonicalPlatformKey(platform);
  const candidates =
    platformKey === "tiktok"
      ? tiktokAuthorAvatarCandidates(row)
      : platformKey === "instagram"
        ? instagramAuthorAvatarCandidates(row)
        : [...instagramAuthorAvatarCandidates(row), ...tiktokAuthorAvatarCandidates(row), ...genericAuthorAvatarCandidates(row)];

  const url = firstHttpUrl(candidates);
  if (!url) return null;
  return isAvatarUrlAllowedForPlatform(platformKey, url) ? url : null;
}
