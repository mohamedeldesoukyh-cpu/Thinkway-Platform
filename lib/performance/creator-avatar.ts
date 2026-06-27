import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { isAvatarUrlNeedsRefresh } from "@/lib/performance/avatar-sync-policy";
import { isSocialPlatform } from "@/lib/social/platforms";

export type CreatorAvatarInput = {
  creator_profile_image_url?: string | null;
  influencer_avatar_url?: string | null;
  social_profile_picture_url?: string | null;
};

/** Creator thumb priority — never use publication screenshot. */
export function resolveCreatorAvatarUrl(input: CreatorAvatarInput): string | null {
  return (
    input.social_profile_picture_url?.trim() ||
    input.influencer_avatar_url?.trim() ||
    input.creator_profile_image_url?.trim() ||
    null
  );
}

export type PublicationCreatorAvatarInput = {
  /** Publication platform — used to avoid cross-platform avatar bleed (e.g. IG photo on TikTok row). */
  platform?: string | null;
  publication_type?: string | null;
  content_url?: string | null;
  /** Discovered profile image (discovery source). */
  creator_profile_image_url?: string | null;
  /** Influencer-level avatar (metadata.avatar_url). */
  influencer_avatar_url?: string | null;
  /** Profile picture from the publication's platform account only — never cross-platform. */
  platform_profile_picture_url?: string | null;
  /** Cached Apify author avatar from metrics collection (display-only fallback). */
  apify_author_avatar_url?: string | null;
};

export type CreatorAvatarDisplay =
  | { kind: "image"; url: string; fallbackUrl?: string | null }
  | { kind: "initials"; name: string; platform: string }
  | { kind: "placeholder"; platform: string };

/** Platforms where generic discovered/metadata avatars are safe (same source as IG posts). */
export function shouldUseGenericCreatorAvatar(platform: string | null | undefined): boolean {
  const key = canonicalPlatformKey(platform ?? "unknown");
  return key === "instagram" || key === "unknown";
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when URL is hosted on Instagram / Meta CDN used for IG profile images. */
export function isInstagramHostedAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  const host = hostFromUrl(trimmed);
  if (!host) return false;
  if (host.includes("cdninstagram")) return true;
  if (host.endsWith("instagram.com") || host === "instagram.com") return true;
  if (host.includes("fbcdn") && trimmed.toLowerCase().includes("instagram")) return true;
  return false;
}

/** True when URL is hosted on TikTok / ByteDance CDN. */
export function isTikTokHostedAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  const host = hostFromUrl(trimmed);
  if (!host) return false;
  if (host.includes("tiktokcdn")) return true;
  if (host.includes("tiktokv.com")) return true;
  if (host.includes("ibyteimg.com")) return true;
  if (host.includes("ibytedtos.com")) return true;
  if (host.includes("byteoversea.com")) return true;
  if (host.includes("muscdn.com")) return true;
  if (host.endsWith("tiktok.com") || host === "tiktok.com") return true;
  return false;
}

/**
 * Strip TikTok CDN signing (x-expires / x-signature) so avatars stay loadable after tokens expire.
 * p16-sign-va.tiktokcdn.com → p16-va.tiktokcdn.com with query params removed.
 */
export function stabilizeTikTokAvatarUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isStabilizable =
      host.includes("tiktokcdn") ||
      host.includes("ibyteimg.com") ||
      host.includes("ibytedtos.com");
    if (!isStabilizable) return url;

    const stabilizedHost = host.replace(/-sign-/g, "-").replace(/-sign\./g, ".");
    if (stabilizedHost === host && !parsed.search) return url;

    parsed.hostname = stabilizedHost;
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

/** True when URL is hosted on YouTube / Google avatar CDN. */
export function isYouTubeHostedAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  const host = hostFromUrl(trimmed);
  if (!host) return false;
  if (host.includes("ggpht.com")) return true;
  if (host.includes("ytimg.com")) return true;
  if (host.includes("googleusercontent.com") && trimmed.toLowerCase().includes("youtube")) {
    return true;
  }
  return false;
}

/** True when URL is hosted on Facebook CDN (non-Instagram). */
export function isFacebookHostedAvatarUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;
  if (isInstagramHostedAvatarUrl(trimmed)) return false;

  const host = hostFromUrl(trimmed);
  if (!host) return false;
  if (host.includes("fbcdn")) return true;
  if (host.endsWith("facebook.com") || host === "facebook.com") return true;
  return false;
}

export type DetectedAvatarCdn =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "unknown";

/** Best-effort CDN owner for platform safety checks. */
export function detectAvatarCdn(url: string | null | undefined): DetectedAvatarCdn {
  if (isInstagramHostedAvatarUrl(url)) return "instagram";
  if (isTikTokHostedAvatarUrl(url)) return "tiktok";
  if (isYouTubeHostedAvatarUrl(url)) return "youtube";
  if (isFacebookHostedAvatarUrl(url)) return "facebook";
  return "unknown";
}

function platformFromContentUrl(contentUrl: string | null | undefined): string | null {
  const raw = contentUrl?.trim();
  if (!raw) return null;

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase();
    if (host.includes("tiktok.com")) return "tiktok";
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("youtube.com") || host === "youtu.be") return "youtube";
    if (host.includes("facebook.com") || host.includes("fb.watch")) return "facebook";
    if (host.includes("snapchat.com")) return "snapchat";
    return null;
  } catch {
    return null;
  }
}

/**
 * Best-effort publication platform for avatar lookup — prefers explicit platform,
 * then deliverable type prefix (tiktok_video → tiktok), then content URL host.
 */
export function resolvePublicationEffectivePlatform(input: {
  platform?: string | null;
  publication_type?: string | null;
  content_url?: string | null;
}): string {
  const explicit = canonicalPlatformKey(input.platform ?? "");
  if (explicit !== "unknown" && isSocialPlatform(explicit)) {
    return explicit;
  }

  const pubType = (input.publication_type ?? "").trim().toLowerCase();
  if (pubType.includes("_")) {
    const prefix = canonicalPlatformKey(pubType.split("_")[0] ?? "");
    if (prefix !== "unknown" && isSocialPlatform(prefix)) {
      return prefix;
    }
  }

  const fromUrl = platformFromContentUrl(input.content_url);
  if (fromUrl) return fromUrl;

  return explicit || "unknown";
}

/**
 * Reject cross-platform CDN bleed and enforce CDN-to-platform matching before persist/display.
 * Unknown CDN URLs are allowed only on Instagram and unknown publication rows.
 */
export function isAvatarUrlAllowedForPlatform(
  platform: string | null | undefined,
  url: string | null | undefined
): boolean {
  const trimmed = url?.trim();
  if (!trimmed) return false;

  const key = resolvePublicationEffectivePlatform({ platform });
  const cdn = detectAvatarCdn(trimmed);

  if (cdn === "instagram" && key !== "instagram" && key !== "unknown") return false;
  if (cdn === "tiktok" && key !== "tiktok") return false;
  if (cdn === "youtube" && key !== "youtube") return false;
  if (cdn === "facebook" && key !== "facebook" && key !== "unknown") return false;

  return true;
}

function firstAllowedAvatarUrl(
  platform: string,
  candidates: Array<string | null | undefined>,
  options?: { normalize?: boolean }
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || isAvatarUrlNeedsRefresh(trimmed)) continue;
    if (isAvatarUrlAllowedForPlatform(platform, trimmed)) {
      return options?.normalize === false
        ? trimmed
        : normalizeAvatarUrlForPlatform(platform, trimmed);
    }
  }
  return null;
}

function isGenericAvatarAllowedForPlatform(platform: string, url: string): boolean {
  if (!isAvatarUrlAllowedForPlatform(platform, url)) return false;
  if (shouldUseGenericCreatorAvatar(platform)) return true;
  const key = resolvePublicationEffectivePlatform({ platform });
  // Cross-platform CDN rules already applied — TikTok/YouTube/etc. may use vendor CDNs
  // (ibyteimg, tiktokcdn, …) that are not Instagram discovery photos.
  if (key !== "instagram" && key !== "unknown") return true;
  return detectAvatarCdn(url) !== "unknown";
}

export function normalizeAvatarUrlForPlatform(platform: string, url: string): string {
  const key = resolvePublicationEffectivePlatform({ platform });
  if (key === "tiktok") return stabilizeTikTokAvatarUrl(url);
  return url;
}

/** Normalize a raw avatar URL for `<img src>` (TikTok signing stripped when applicable). */
export function prepareCreatorAvatarUrlForDisplay(
  platform: string | null | undefined,
  url: string | null | undefined
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return normalizeAvatarUrlForPlatform(
    resolvePublicationEffectivePlatform({ platform: platform ?? "" }),
    trimmed
  );
}

/** Primary display URL plus optional signed/original fallback when stabilization changes the URL. */
export function creatorAvatarDisplayUrls(
  platform: string | null | undefined,
  url: string | null | undefined
): { primary: string; fallback: string | null } | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const primary = prepareCreatorAvatarUrlForDisplay(platform, trimmed) ?? trimmed;
  return { primary, fallback: primary !== trimmed ? trimmed : null };
}

function firstGenericAvatarUrl(
  platform: string,
  candidates: Array<string | null | undefined>,
  options?: { normalize?: boolean }
): string | null {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || isAvatarUrlNeedsRefresh(trimmed)) continue;
    if (isGenericAvatarAllowedForPlatform(platform, trimmed)) {
      return options?.normalize === false
        ? trimmed
        : normalizeAvatarUrlForPlatform(platform, trimmed);
    }
  }
  return null;
}

/**
 * Publication avatar URL resolution — single source of truth.
 *
 * Priority:
 * 1. influencer_platform_accounts.profile_picture_url (platform-matched)
 * 2. influencers.avatar_url / metadata avatar
 * 3. Apify author avatar (cached from metrics sync)
 * 4. Discovery profile image (Instagram / unknown only)
 */
export function resolvePublicationCreatorAvatar(
  input: PublicationCreatorAvatarInput
): string | null {
  const platform = resolvePublicationEffectivePlatform(input);

  const platformPicture = firstAllowedAvatarUrl(platform, [
    input.platform_profile_picture_url,
  ]);
  if (platformPicture) return platformPicture;

  const influencerAvatar = firstGenericAvatarUrl(platform, [input.influencer_avatar_url]);
  if (influencerAvatar) return influencerAvatar;

  const apifyAvatar = firstGenericAvatarUrl(platform, [input.apify_author_avatar_url]);
  if (apifyAvatar) return apifyAvatar;

  if (!shouldUseGenericCreatorAvatar(platform)) {
    return null;
  }

  return firstGenericAvatarUrl(platform, [input.creator_profile_image_url]);
}

/** Grid/workspace row — always platform-aware; never trust pre-resolved creator_avatar_url alone. */
export function resolvePublicationRowCreatorAvatar(row: {
  platform: string;
  publication_type?: string | null;
  content_url?: string | null;
  creator_profile_image_url?: string | null;
  influencer_avatar_url?: string | null;
  social_profile_picture_url?: string | null;
  apify_author_avatar_url?: string | null;
}): string | null {
  return resolvePublicationCreatorAvatar({
    platform: row.platform,
    publication_type: row.publication_type,
    content_url: row.content_url,
    creator_profile_image_url: row.creator_profile_image_url,
    influencer_avatar_url: row.influencer_avatar_url,
    platform_profile_picture_url: row.social_profile_picture_url,
    apify_author_avatar_url: row.apify_author_avatar_url,
  });
}

/**
 * Full display resolution including initials and platform icon fallbacks.
 * Use in UI components that render creator identity.
 */
export function resolveCreatorAvatarDisplay(input: {
  platform: string;
  publication_type?: string | null;
  content_url?: string | null;
  creator_profile_image_url?: string | null;
  influencer_avatar_url?: string | null;
  social_profile_picture_url?: string | null;
  apify_author_avatar_url?: string | null;
  influencer_name?: string | null;
}): CreatorAvatarDisplay {
  const platform = resolvePublicationEffectivePlatform(input);
  const url = resolvePublicationRowCreatorAvatar(input);

  if (url) {
    const raw =
      firstAllowedAvatarUrl(platform, [input.social_profile_picture_url], { normalize: false }) ??
      firstGenericAvatarUrl(platform, [input.influencer_avatar_url], { normalize: false }) ??
      firstGenericAvatarUrl(platform, [input.apify_author_avatar_url], { normalize: false }) ??
      (shouldUseGenericCreatorAvatar(platform)
        ? firstGenericAvatarUrl(platform, [input.creator_profile_image_url], { normalize: false })
        : null);
    return {
      kind: "image",
      url,
      fallbackUrl: raw && raw !== url ? raw : null,
    };
  }

  const name = input.influencer_name?.trim();
  if (name) {
    return { kind: "initials", name, platform };
  }

  return { kind: "placeholder", platform };
}

export function initialsFromCreatorName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return "C";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase() || "C";
}

export type PublicationContentPreviewInput = {
  screenshot_url?: string | null;
  thumbnail_url?: string | null;
};

/** Post content preview: screenshot → thumbnail (never creator avatar). */
export function resolvePublicationContentPreviewUrl(
  row: PublicationContentPreviewInput
): string | null {
  return row.screenshot_url ?? row.thumbnail_url ?? null;
}
