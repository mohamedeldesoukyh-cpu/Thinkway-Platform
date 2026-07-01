import { tryOpenGraphThumbnail } from "@/lib/performance/screenshot-capture/providers/opengraph";

import {
  fetchImageBuffer,
  isAllowedPublicationPreviewSrcUrl,
} from "@/lib/creators/publication-preview-proxy";

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Social profile pages usable for OpenGraph avatar fallback. */
export function isAllowedCreatorAvatarProfileUrl(url: string): boolean {
  const host = hostFromUrl(url);
  if (!host) return false;
  if (host.includes("instagram.com")) return true;
  if (host.includes("tiktok.com")) return true;
  if (host.includes("youtube.com") || host === "youtu.be") return true;
  return false;
}

/** Server-side fetch for creator avatars — CDN direct load, then profile OpenGraph fallback. */
export async function fetchCreatorAvatarImage(input: {
  src?: string | null;
  profileUrl?: string | null;
}): Promise<
  { ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false; status: number }
> {
  const src = input.src?.trim() || null;
  const profileUrl = input.profileUrl?.trim() || null;

  if (src && isAllowedPublicationPreviewSrcUrl(src)) {
    const direct = await fetchImageBuffer(src);
    if (direct.ok) return direct;
  }

  if (profileUrl && isAllowedCreatorAvatarProfileUrl(profileUrl)) {
    const og = await tryOpenGraphThumbnail({ contentUrl: profileUrl });
    if (og.imageUrl && isAllowedPublicationPreviewSrcUrl(og.imageUrl)) {
      const fromOg = await fetchImageBuffer(og.imageUrl);
      if (fromOg.ok) return fromOg;
    }
  }

  return { ok: false, status: 404 };
}
