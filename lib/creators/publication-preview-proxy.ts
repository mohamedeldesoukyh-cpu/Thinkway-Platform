import {
  MEDIA_PROXY_FAST_TIMEOUT_MS,
  MEDIA_PROXY_REFRESH_TIMEOUT_MS,
  getMediaProxyCache,
  mediaProxyCacheKey,
  recordMediaProxyCdnHit,
  recordMediaProxyExternalRequest,
  recordMediaProxyPlaceholder,
  recordMediaProxyRefreshFailed,
  recordMediaProxyRefreshSuccess,
  setMediaProxyCacheNegative,
  setMediaProxyCachePositive,
  withMediaProxyInflight,
} from "@/lib/creators/media-proxy-cache";
import { tryInstagramMediaRedirectThumbnail } from "@/lib/performance/screenshot-capture/providers/instagram-media-redirect";
import { tryInstagramOembedThumbnail } from "@/lib/performance/screenshot-capture/providers/instagram-oembed";
import { tryOpenGraphThumbnail } from "@/lib/performance/screenshot-capture/providers/opengraph";
import { tryTikTokOembedThumbnail } from "@/lib/performance/screenshot-capture/providers/tiktok-oembed";

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const ALLOWED_SRC_HOST_FRAGMENTS = [
  "cdninstagram",
  "instagram.com",
  "fbcdn",
  "fbsbx.com",
  "facebook.com",
  "tiktokcdn",
  "tiktokv.com",
  "ibyteimg.com",
  "ibytedtos.com",
  "byteoversea.com",
  "ttwstatic.com",
  "muscdn.com",
  "ytimg.com",
];

const ALLOWED_POST_HOST_FRAGMENTS = ["instagram.com", "tiktok.com", "youtube.com", "youtu.be"];

const TIKTOK_CDN_HOST_FRAGMENTS = [
  "tiktokcdn",
  "tiktokv.com",
  "ibyteimg.com",
  "ibytedtos.com",
  "byteoversea.com",
  "ttwstatic.com",
  "muscdn.com",
];

export function isAllowedPublicationPreviewSrcUrl(url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  return ALLOWED_SRC_HOST_FRAGMENTS.some((fragment) => host.includes(fragment));
}

export function isAllowedPublicationPreviewPostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  return ALLOWED_POST_HOST_FRAGMENTS.some((fragment) => host.includes(fragment));
}

function refererForImageUrl(url: string): string | undefined {
  const host = hostFromUrl(url);
  if (!host) return undefined;
  if (TIKTOK_CDN_HOST_FRAGMENTS.some((fragment) => host.includes(fragment))) {
    return "https://www.tiktok.com/";
  }
  if (host.includes("cdninstagram") || host.includes("fbcdn") || host.includes("instagram.com")) {
    return "https://www.instagram.com/";
  }
  if (host.includes("fbsbx.com") || host.includes("facebook.com")) {
    return "https://www.instagram.com/";
  }
  return undefined;
}

function isTikTokPostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  return host?.includes("tiktok.com") ?? false;
}

function isInstagramPostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  return host?.includes("instagram.com") ?? false;
}

export async function fetchImageBuffer(
  url: string,
  options?: { referer?: string | null; timeoutMs?: number; countExternal?: boolean }
): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false }> {
  const referer = options?.referer ?? refererForImageUrl(url);
  const timeoutMs = options?.timeoutMs ?? MEDIA_PROXY_REFRESH_TIMEOUT_MS;
  if (options?.countExternal !== false) {
    recordMediaProxyExternalRequest();
  }
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (!response.ok) return { ok: false };

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return { ok: false };

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) return { ok: false };
    return { ok: true, buffer, contentType };
  } catch {
    return { ok: false };
  }
}

type PreviewResult =
  | { ok: true; buffer: ArrayBuffer; contentType: string; source: "cache" | "cdn" | "refresh" }
  | { ok: false; status: number; source: "cache" | "miss"; needsRefresh: boolean };

function previewKey(src: string | null, postUrl: string | null): string {
  return mediaProxyCacheKey({ kind: "preview", src, postUrl });
}

/** Full resolution path (exports / background refresh) — may call oEmbed/OpenGraph. */
export async function fetchPublicationPreviewImage(input: {
  src?: string | null;
  postUrl?: string | null;
}): Promise<
  { ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false; status: number }
> {
  const src = input.src?.trim() || null;
  const postUrl = input.postUrl?.trim() || null;
  const key = previewKey(src, postUrl);

  return withMediaProxyInflight(`refresh:${key}`, async () => {
    const resolved = await resolvePublicationPreviewExternal({ src, postUrl });
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

async function resolvePublicationPreviewExternal(input: {
  src: string | null;
  postUrl: string | null;
}): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false }> {
  const { src, postUrl } = input;

  if (src && isAllowedPublicationPreviewSrcUrl(src)) {
    const direct = await fetchImageBuffer(src, { timeoutMs: MEDIA_PROXY_REFRESH_TIMEOUT_MS });
    if (direct.ok) return direct;
  }

  if (postUrl && isAllowedPublicationPreviewPostUrl(postUrl)) {
    if (isTikTokPostUrl(postUrl)) {
      recordMediaProxyExternalRequest();
      const oembed = await tryTikTokOembedThumbnail({ contentUrl: postUrl });
      if (oembed.imageUrl) {
        const fromOembed = await fetchImageBuffer(oembed.imageUrl);
        if (fromOembed.ok) return fromOembed;
      }
    }

    if (isInstagramPostUrl(postUrl)) {
      recordMediaProxyExternalRequest();
      const mediaRedirect = await tryInstagramMediaRedirectThumbnail({ contentUrl: postUrl });
      if (mediaRedirect.imageUrl) {
        const fromRedirect = await fetchImageBuffer(mediaRedirect.imageUrl);
        if (fromRedirect.ok) return fromRedirect;
      }

      recordMediaProxyExternalRequest();
      const oembed = await tryInstagramOembedThumbnail({ contentUrl: postUrl });
      if (oembed.imageUrl) {
        const fromOembed = await fetchImageBuffer(oembed.imageUrl);
        if (fromOembed.ok) return fromOembed;
      }
    }

    recordMediaProxyExternalRequest();
    const og = await tryOpenGraphThumbnail({ contentUrl: postUrl });
    if (og.imageUrl) {
      const fromOg = await fetchImageBuffer(og.imageUrl);
      if (fromOg.ok) return fromOg;
    }
  }

  return { ok: false };
}

/**
 * Request-path resolver — cache + short CDN only. Never runs oEmbed/OpenGraph/HTML scrape.
 * Callers should schedule refreshPublicationPreviewInBackground on needsRefresh.
 */
export async function resolvePublicationPreviewForHttpRequest(input: {
  src?: string | null;
  postUrl?: string | null;
}): Promise<PreviewResult> {
  const src = input.src?.trim() || null;
  const postUrl = input.postUrl?.trim() || null;
  const key = previewKey(src, postUrl);

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
    return { ok: false, status: cached.status, source: "cache", needsRefresh: false };
  }

  if (src && isAllowedPublicationPreviewSrcUrl(src)) {
    const direct = await withMediaProxyInflight(`cdn:${key}`, () =>
      fetchImageBuffer(src, { timeoutMs: MEDIA_PROXY_FAST_TIMEOUT_MS })
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
      (postUrl && isAllowedPublicationPreviewPostUrl(postUrl))
  );

  recordMediaProxyPlaceholder();
  return {
    ok: false,
    status: 404,
    source: "miss",
    needsRefresh,
  };
}

export async function refreshPublicationPreviewInBackground(input: {
  src?: string | null;
  postUrl?: string | null;
}): Promise<void> {
  try {
    await fetchPublicationPreviewImage(input);
  } catch {
    recordMediaProxyRefreshFailed();
  }
}
