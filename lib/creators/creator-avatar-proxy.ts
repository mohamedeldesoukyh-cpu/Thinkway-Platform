import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MEDIA_PROXY_FAST_TIMEOUT_MS,
  MEDIA_PROXY_REFRESH_TIMEOUT_MS,
  MEDIA_PROXY_STORAGE_TIMEOUT_MS,
  getMediaProxyCache,
  mediaProxyCacheKey,
  recordMediaProxyCdnHit,
  recordMediaProxyExternalRequest,
  recordMediaProxyPlaceholder,
  recordMediaProxyRefreshFailed,
  recordMediaProxyRefreshSuccess,
  recordMediaProxyStorageHit,
  setMediaProxyCacheNegative,
  setMediaProxyCachePositive,
  withMediaProxyInflight,
} from "@/lib/creators/media-proxy-cache";
import {
  CREATOR_AVATARS_BUCKET,
  parseCreatorAvatarStoragePathFromUrl,
} from "@/lib/discovery-import/import-avatar-storage";
import { tryOpenGraphThumbnail } from "@/lib/performance/screenshot-capture/providers/opengraph";
import { isInstagramCdnUrlExpired } from "@/lib/performance/avatar-sync-policy";
import type { Database } from "@/types/database";

import {
  fetchImageBuffer,
  isAllowedPublicationPreviewSrcUrl,
} from "@/lib/creators/publication-preview-proxy";
import {
  SOCIAL_PROFILE_ALLOWLIST,
  fetchWithStrictRedirects,
  isUrlAllowedByHostlist,
} from "@/lib/security/ssrf";

function decodeEmbeddedUrl(value: string): string {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/\\u003d/g, "=")
    .replace(/\\\//g, "/")
    .replace(/\\"/g, '"');
}

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i"
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEmbeddedUrl(match[1].trim());
  }

  return null;
}

function extractEmbeddedProfilePictureUrls(html: string): string[] {
  const urls: string[] = [];
  const patterns = [
    /"profile_pic_url_hd":"([^"]+)"/g,
    /"profile_pic_url":"([^"]+)"/g,
    /"avatar_url":"([^"]+)"/g,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const candidate = decodeEmbeddedUrl(match[1] ?? "");
      if (candidate.startsWith("http")) urls.push(candidate);
    }
  }

  return urls;
}

async function fetchProfilePageHtml(profileUrl: string): Promise<string | null> {
  if (!isAllowedCreatorAvatarProfileUrl(profileUrl)) return null;
  recordMediaProxyExternalRequest();
  try {
    const response = await fetchWithStrictRedirects(profileUrl, {
      allowlist: SOCIAL_PROFILE_ALLOWLIST,
      maxRedirects: 3,
      timeoutMs: MEDIA_PROXY_REFRESH_TIMEOUT_MS,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 800_000);
  } catch {
    return null;
  }
}

async function resolveProfilePictureFromSocialPage(
  profileUrl: string
): Promise<string | null> {
  const html = await fetchProfilePageHtml(profileUrl);
  if (!html) return null;

  const ogImage = extractMetaContent(html, "og:image");
  if (ogImage && isAllowedPublicationPreviewSrcUrl(ogImage)) {
    return ogImage;
  }

  for (const candidate of extractEmbeddedProfilePictureUrls(html)) {
    if (isAllowedPublicationPreviewSrcUrl(candidate)) {
      return candidate;
    }
  }

  return null;
}

/** Social profile pages usable for OpenGraph avatar fallback. */
export function isAllowedCreatorAvatarProfileUrl(url: string): boolean {
  return isUrlAllowedByHostlist(url, SOCIAL_PROFILE_ALLOWLIST);
}

async function fetchThinkwayStoredAvatar(
  supabase: SupabaseClient<Database>,
  src: string,
  timeoutMs: number
): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | null> {
  const storagePath = parseCreatorAvatarStoragePathFromUrl(src);
  if (!storagePath) return null;

  try {
    const download = supabase.storage.from(CREATOR_AVATARS_BUCKET).download(storagePath);
    const data = await Promise.race([
      download.then((result) => result),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);

    if (!data || data.error || !data.data) return null;

    const buffer = await data.data.arrayBuffer();
    return {
      ok: true,
      buffer,
      contentType: data.data.type || "image/jpeg",
    };
  } catch {
    return null;
  }
}

/**
 * Public creator-avatars URLs are not on the social CDN allowlist — fetch them
 * directly so PDF/PPTX export can embed durable Thinkway storage avatars.
 */
async function fetchThinkwayStoredAvatarHttp(
  src: string,
  timeoutMs: number
): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | null> {
  if (!parseCreatorAvatarStoragePathFromUrl(src)) return null;

  try {
    const response = await fetch(src, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "image/*,*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    if (!buffer.byteLength) return null;
    const headerType = response.headers.get("content-type")?.split(";")[0]?.trim();
    const contentType =
      headerType && headerType.startsWith("image/") ? headerType : "image/jpeg";
    return { ok: true, buffer, contentType };
  } catch {
    return null;
  }
}

function avatarKey(src: string | null, profileUrl: string | null): string {
  return mediaProxyCacheKey({ kind: "avatar", src, profileUrl });
}

type AvatarHttpResult =
  | {
      ok: true;
      buffer: ArrayBuffer;
      contentType: string;
      source: "cache" | "storage" | "cdn";
    }
  | { ok: false; status: number; source: "cache" | "miss"; needsRefresh: boolean };

async function resolveCreatorAvatarExternal(input: {
  src: string | null;
  profileUrl: string | null;
  supabase?: SupabaseClient<Database> | null;
}): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false }> {
  const { src, profileUrl, supabase } = input;

  if (src && supabase) {
    const stored = await fetchThinkwayStoredAvatar(
      supabase,
      src,
      MEDIA_PROXY_REFRESH_TIMEOUT_MS
    );
    if (stored) return stored;
  }

  if (src) {
    const storedHttp = await fetchThinkwayStoredAvatarHttp(
      src,
      MEDIA_PROXY_REFRESH_TIMEOUT_MS
    );
    if (storedHttp) return storedHttp;
  }

  const freshCdnSrc =
    src && isAllowedPublicationPreviewSrcUrl(src) && !isInstagramCdnUrlExpired(src)
      ? src
      : null;

  if (freshCdnSrc) {
    const direct = await fetchImageBuffer(freshCdnSrc, {
      timeoutMs: MEDIA_PROXY_REFRESH_TIMEOUT_MS,
    });
    if (direct.ok) return direct;
  }

  if (profileUrl && isAllowedCreatorAvatarProfileUrl(profileUrl)) {
    const resolvedPicture = await resolveProfilePictureFromSocialPage(profileUrl);
    if (resolvedPicture) {
      const fromProfilePage = await fetchImageBuffer(resolvedPicture);
      if (fromProfilePage.ok) return fromProfilePage;
    }

    recordMediaProxyExternalRequest();
    const og = await tryOpenGraphThumbnail({ contentUrl: profileUrl });
    if (og.imageUrl && isAllowedPublicationPreviewSrcUrl(og.imageUrl)) {
      const fromOg = await fetchImageBuffer(og.imageUrl);
      if (fromOg.ok) return fromOg;
    }
  }

  if (
    src &&
    isAllowedPublicationPreviewSrcUrl(src) &&
    isInstagramCdnUrlExpired(src)
  ) {
    const expiredAttempt = await fetchImageBuffer(src);
    if (expiredAttempt.ok) return expiredAttempt;
  }

  return { ok: false };
}

/**
 * Full avatar resolution (exports / background refresh).
 * May scrape social profiles and call OpenGraph — do not use on interactive page render path.
 */
export async function fetchCreatorAvatarImage(input: {
  src?: string | null;
  profileUrl?: string | null;
  supabase?: SupabaseClient<Database> | null;
}): Promise<
  { ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false; status: number }
> {
  const src = input.src?.trim() || null;
  const profileUrl = input.profileUrl?.trim() || null;
  const key = avatarKey(src, profileUrl);

  return withMediaProxyInflight(`refresh:${key}`, async () => {
    const resolved = await resolveCreatorAvatarExternal({
      src,
      profileUrl,
      supabase: input.supabase,
    });
    if (resolved.ok) {
      setMediaProxyCachePositive(key, resolved.buffer, resolved.contentType);
      recordMediaProxyRefreshSuccess();
      return resolved;
    }
    setMediaProxyCacheNegative(key, 404);
    recordMediaProxyRefreshFailed();
    return { ok: false, status: 404 };
  });
}

/**
 * Request-path resolver — memory cache, Thinkway storage, short CDN only.
 * Never scrapes HTML or OpenGraph. Schedule refreshCreatorAvatarInBackground on needsRefresh.
 */
export async function resolveCreatorAvatarForHttpRequest(input: {
  src?: string | null;
  profileUrl?: string | null;
  supabase?: SupabaseClient<Database> | null;
}): Promise<AvatarHttpResult> {
  const src = input.src?.trim() || null;
  const profileUrl = input.profileUrl?.trim() || null;
  const key = avatarKey(src, profileUrl);

  const cached = getMediaProxyCache(key);
  if (cached?.ok) {
    return {
      ok: true,
      buffer: cached.buffer,
      contentType: cached.contentType,
      source: "cache",
    };
  }
  if (cached && !cached.ok) {
    recordMediaProxyPlaceholder();
    // Keep warming when a social profile URL (or expired IG CDN) can still recover —
    // otherwise client retries stick on silhouette for the full negative TTL.
    const canRetryWarm = Boolean(
      (profileUrl && isAllowedCreatorAvatarProfileUrl(profileUrl)) ||
        (src && isInstagramCdnUrlExpired(src))
    );
    return {
      ok: false,
      status: cached.status,
      source: "cache",
      needsRefresh: canRetryWarm,
    };
  }

  if (src && input.supabase) {
    const stored = await withMediaProxyInflight(`storage:${key}`, () =>
      fetchThinkwayStoredAvatar(input.supabase!, src, MEDIA_PROXY_STORAGE_TIMEOUT_MS)
    );
    if (stored) {
      setMediaProxyCachePositive(key, stored.buffer, stored.contentType);
      recordMediaProxyStorageHit();
      return {
        ok: true,
        buffer: stored.buffer,
        contentType: stored.contentType,
        source: "storage",
      };
    }
  }

  const freshCdnSrc =
    src && isAllowedPublicationPreviewSrcUrl(src) && !isInstagramCdnUrlExpired(src)
      ? src
      : null;

  if (freshCdnSrc) {
    const direct = await withMediaProxyInflight(`cdn:${key}`, () =>
      fetchImageBuffer(freshCdnSrc, { timeoutMs: MEDIA_PROXY_FAST_TIMEOUT_MS })
    );
    if (direct.ok) {
      setMediaProxyCachePositive(key, direct.buffer, direct.contentType);
      recordMediaProxyCdnHit();
      return {
        ok: true,
        buffer: direct.buffer,
        contentType: direct.contentType,
        source: "cdn",
      };
    }
  }

  const needsRefresh = Boolean(
    (src && isAllowedPublicationPreviewSrcUrl(src)) ||
      (profileUrl && isAllowedCreatorAvatarProfileUrl(profileUrl)) ||
      (src && parseCreatorAvatarStoragePathFromUrl(src))
  );

  recordMediaProxyPlaceholder();
  return {
    ok: false,
    status: 404,
    source: "miss",
    needsRefresh,
  };
}

export async function refreshCreatorAvatarInBackground(input: {
  src?: string | null;
  profileUrl?: string | null;
  supabase?: SupabaseClient<Database> | null;
}): Promise<void> {
  try {
    await fetchCreatorAvatarImage(input);
  } catch {
    recordMediaProxyRefreshFailed();
  }
}
