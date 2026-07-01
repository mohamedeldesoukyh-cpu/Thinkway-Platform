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
  return undefined;
}

function isTikTokPostUrl(url: string): boolean {
  const host = hostFromUrl(url);
  return host?.includes("tiktok.com") ?? false;
}

async function fetchImageBuffer(
  url: string,
  options?: { referer?: string | null }
): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false }> {
  const referer = options?.referer ?? refererForImageUrl(url);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (compatible; ThinkwayBot/1.0; +https://thinkway.com)",
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

/** Server-side fetch for creator publication preview images (CDN + oEmbed/OpenGraph fallback). */
export async function fetchPublicationPreviewImage(input: {
  src?: string | null;
  postUrl?: string | null;
}): Promise<
  { ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false; status: number }
> {
  const src = input.src?.trim() || null;
  const postUrl = input.postUrl?.trim() || null;

  if (src && isAllowedPublicationPreviewSrcUrl(src)) {
    const direct = await fetchImageBuffer(src);
    if (direct.ok) return direct;
  }

  if (postUrl && isAllowedPublicationPreviewPostUrl(postUrl)) {
    if (isTikTokPostUrl(postUrl)) {
      const oembed = await tryTikTokOembedThumbnail({ contentUrl: postUrl });
      if (oembed.imageUrl && isAllowedPublicationPreviewSrcUrl(oembed.imageUrl)) {
        const fromOembed = await fetchImageBuffer(oembed.imageUrl);
        if (fromOembed.ok) return fromOembed;
      }
    }

    const og = await tryOpenGraphThumbnail({ contentUrl: postUrl });
    if (og.imageUrl && isAllowedPublicationPreviewSrcUrl(og.imageUrl)) {
      const fromOg = await fetchImageBuffer(og.imageUrl);
      if (fromOg.ok) return fromOg;
    }
  }

  return { ok: false, status: 404 };
}

export { fetchImageBuffer };
