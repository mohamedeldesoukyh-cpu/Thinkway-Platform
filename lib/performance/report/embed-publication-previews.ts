import {
  fetchImageBuffer,
  fetchPublicationPreviewImage,
} from "@/lib/creators/publication-preview-proxy";
import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { shouldProxyPublicationMediaUrl } from "@/lib/creators/recent-publication-thumb";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PublicationPreviewEmbedInput = {
  screenshot_url?: string | null;
  thumbnail_url?: string | null;
  content_url?: string | null;
};

function storedPreviewUrl(row: PublicationPreviewEmbedInput): string | null {
  return row.screenshot_url?.trim() || row.thumbnail_url?.trim() || null;
}

/** Embed original bytes. Reports must not resize, recompress, or recolor media. */
export function toUnprocessedImageDataUri(
  buffer: Buffer,
  contentType?: string | null
): string {
  const type =
    contentType?.split(";")[0]?.trim() || detectImageContentType(buffer) || "image/jpeg";
  return `data:${type};base64,${buffer.toString("base64")}`;
}

async function embedStoredUrlAsOriginal(url: string): Promise<string | null> {
  if (shouldProxyPublicationMediaUrl(url)) {
    const fetched = await fetchImageBuffer(url);
    if (fetched.ok) {
      return toUnprocessedImageDataUri(
        Buffer.from(fetched.buffer),
        fetched.contentType
      );
    }
    return null;
  }

  if (!url.includes("://")) return null;
  const embedded = await embedReportImageDataUri(url);
  return embedded?.startsWith("data:") ? embedded : null;
}

/**
 * Embed a campaign publication snapshot as a data URI for HTML/PDF/PPT.
 * Uses the best available original bytes from stored screenshot/thumbnail or the
 * live post (oEmbed / OpenGraph). Does not resize, compress, or filter.
 */
export async function embedCampaignPublicationPreview(
  row: PublicationPreviewEmbedInput
): Promise<string | null> {
  const stored = storedPreviewUrl(row);
  const postUrl = row.content_url?.trim() || null;

  if (stored?.startsWith("data:")) {
    return stored;
  }

  if (stored && !shouldProxyPublicationMediaUrl(stored) && stored.includes("://")) {
    const embedded = await embedStoredUrlAsOriginal(stored);
    if (embedded) return embedded;
  }

  const socialSrc = stored && shouldProxyPublicationMediaUrl(stored) ? stored : null;
  if (socialSrc || postUrl) {
    const preview = await fetchPublicationPreviewImage({
      src: socialSrc,
      postUrl,
    });
    if (preview.ok) {
      return toUnprocessedImageDataUri(
        Buffer.from(preview.buffer),
        preview.contentType
      );
    }
    const display = await fetchPublicationPreviewImage({
      src: socialSrc,
      postUrl,
      quality: "display",
    });
    if (display.ok) {
      return toUnprocessedImageDataUri(
        Buffer.from(display.buffer),
        display.contentType
      );
    }
  }

  if (stored) {
    return embedStoredUrlAsOriginal(stored);
  }

  return null;
}

/** Embed original avatar bytes for Combined/Influencer HTML + PDF (srcDoc cannot load social CDNs). */
export async function embedReportCreatorAvatar(input: {
  src?: string | null;
  profileUrl?: string | null;
  supabase?: SupabaseClient<Database> | null;
}): Promise<string | null> {
  const src = input.src?.trim() || null;
  const profileUrl = input.profileUrl?.trim() || null;
  if (src?.startsWith("data:")) return src;
  if (!src && !profileUrl) return null;

  const fetched = await fetchCreatorAvatarImage({
    src,
    profileUrl,
    supabase: input.supabase,
  });
  if (fetched.ok) {
    return toUnprocessedImageDataUri(
      Buffer.from(fetched.buffer),
      fetched.contentType
    );
  }

  if (src) {
    const embedded = await embedReportImageDataUri(src);
    return embedded?.startsWith("data:") ? embedded : null;
  }

  return null;
}
