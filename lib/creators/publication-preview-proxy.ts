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
import { tryFacebookOembedThumbnail } from "@/lib/performance/screenshot-capture/providers/facebook-oembed";
import { tryInstagramMediaRedirectThumbnail } from "@/lib/performance/screenshot-capture/providers/instagram-media-redirect";
import { tryInstagramOembedThumbnail } from "@/lib/performance/screenshot-capture/providers/instagram-oembed";
import { tryOpenGraphThumbnail } from "@/lib/performance/screenshot-capture/providers/opengraph";
import { tryTikTokOembedThumbnail } from "@/lib/performance/screenshot-capture/providers/tiktok-oembed";
import { tryYouTubeThumbnail } from "@/lib/performance/screenshot-capture/providers/youtube-thumbnail";
import {
  SOCIAL_MEDIA_SRC_ALLOWLIST,
  SOCIAL_POST_ALLOWLIST,
  fetchWithStrictRedirects,
  isExactHostOrSuffix,
  isUrlAllowedByHostlist,
  parseSafeOutboundUrl,
} from "@/lib/security/ssrf";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";

function hostFromUrl(url: string): string | null {
  const parsed = parseSafeOutboundUrl(url);
  return parsed.ok ? parsed.hostname : null;
}

export function isAllowedPublicationPreviewSrcUrl(url: string): boolean {
  return isUrlAllowedByHostlist(url, SOCIAL_MEDIA_SRC_ALLOWLIST);
}

export function isAllowedPublicationPreviewPostUrl(url: string): boolean {
  return isUrlAllowedByHostlist(url, SOCIAL_POST_ALLOWLIST);
}

export function refererForPublicationImageUrl(url: string): string | undefined {
  const host = hostFromUrl(url);
  if (!host) return undefined;
  if (
    isExactHostOrSuffix(host, {
      exact: [],
      suffixes: [
        "tiktokcdn.com",
        "tiktokcdn-us.com",
        "tiktokv.com",
        "ibyteimg.com",
        "ibytedtos.com",
        "byteoversea.com",
        "ttwstatic.com",
        "muscdn.com",
      ],
    })
  ) {
    return "https://www.tiktok.com/";
  }
  if (
    isExactHostOrSuffix(host, {
      exact: ["youtu.be", "i.ytimg.com", "img.youtube.com"],
      suffixes: ["ytimg.com", "youtube.com"],
    })
  ) {
    return "https://www.youtube.com/";
  }
  if (
    isExactHostOrSuffix(host, {
      exact: [],
      suffixes: ["cdninstagram.com", "instagram.com", "fbsbx.com"],
    })
  ) {
    return "https://www.instagram.com/";
  }
  if (
    isExactHostOrSuffix(host, {
      exact: ["fb.watch"],
      suffixes: ["fbcdn.net", "facebook.com", "fb.com"],
    })
  ) {
    return "https://www.facebook.com/";
  }
  if (
    isExactHostOrSuffix(host, {
      exact: [],
      suffixes: ["sc-cdn.net", "snapchat.com"],
    })
  ) {
    return "https://www.snapchat.com/";
  }
  return undefined;
}

function isTikTokPostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  return host ? isExactHostOrSuffix(host, { exact: [], suffixes: ["tiktok.com"] }) : false;
}

function isInstagramPostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  return host ? isExactHostOrSuffix(host, { exact: [], suffixes: ["instagram.com"] }) : false;
}

function isYouTubePostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  return host
    ? isExactHostOrSuffix(host, { exact: ["youtu.be"], suffixes: ["youtube.com"] })
    : false;
}

function isFacebookPostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  return host
    ? isExactHostOrSuffix(host, {
        exact: ["fb.watch"],
        suffixes: ["facebook.com", "fb.com"],
      })
    : false;
}

export async function fetchImageBuffer(
  url: string,
  options?: { referer?: string | null; timeoutMs?: number; countExternal?: boolean }
): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false }> {
  // Facebook og:image / CDN links often arrive HTML-encoded (`&amp;`).
  const normalizedUrl = decodeHtmlEntities(url.trim());
  if (!isAllowedPublicationPreviewSrcUrl(normalizedUrl)) {
    return { ok: false };
  }

  const referer = options?.referer ?? refererForPublicationImageUrl(normalizedUrl);
  const timeoutMs = options?.timeoutMs ?? MEDIA_PROXY_REFRESH_TIMEOUT_MS;
  if (options?.countExternal !== false) {
    recordMediaProxyExternalRequest();
  }
  try {
    const response = await fetchWithStrictRedirects(normalizedUrl, {
      allowlist: SOCIAL_MEDIA_SRC_ALLOWLIST,
      maxRedirects: 3,
      timeoutMs,
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

    if (isYouTubePostUrl(postUrl)) {
      recordMediaProxyExternalRequest();
      const youtube = await tryYouTubeThumbnail({ contentUrl: postUrl });
      if (youtube.imageUrl) {
        const fromYoutube = await fetchImageBuffer(youtube.imageUrl);
        if (fromYoutube.ok) return fromYoutube;
      }
    }

    if (isFacebookPostUrl(postUrl)) {
      recordMediaProxyExternalRequest();
      const oembed = await tryFacebookOembedThumbnail({ contentUrl: postUrl });
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
