import type { SupabaseClient } from "@supabase/supabase-js";

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

async function fetchThinkwayStoredAvatar(
  supabase: SupabaseClient<Database>,
  src: string
): Promise<{ ok: true; buffer: ArrayBuffer; contentType: string } | null> {
  const storagePath = parseCreatorAvatarStoragePathFromUrl(src);
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from(CREATOR_AVATARS_BUCKET)
    .download(storagePath);
  if (error || !data) return null;

  const buffer = await data.arrayBuffer();
  return {
    ok: true,
    buffer,
    contentType: data.type || "image/jpeg",
  };
}

/** Server-side fetch for creator avatars — storage, CDN direct load, then profile OpenGraph fallback. */
export async function fetchCreatorAvatarImage(input: {
  src?: string | null;
  profileUrl?: string | null;
  supabase?: SupabaseClient<Database> | null;
}): Promise<
  { ok: true; buffer: ArrayBuffer; contentType: string } | { ok: false; status: number }
> {
  const src = input.src?.trim() || null;
  const profileUrl = input.profileUrl?.trim() || null;

  if (src && input.supabase) {
    const stored = await fetchThinkwayStoredAvatar(input.supabase, src);
    if (stored) return stored;
  }

  const cdnSrc =
    src && isAllowedPublicationPreviewSrcUrl(src) && !isInstagramCdnUrlExpired(src)
      ? src
      : null;

  if (cdnSrc) {
    const direct = await fetchImageBuffer(cdnSrc);
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
