import {
  fetchPublicationPreviewImage,
} from "@/lib/creators/publication-preview-proxy";
import { shouldProxyPublicationMediaUrl } from "@/lib/creators/recent-publication-thumb";
import {
  SHOWCASE_PUBLICATION_COMPRESS,
  compressExportDataUri,
  toCompressedExportDataUri,
} from "@/lib/io/compress-export-image";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";

export type PublicationPreviewEmbedInput = {
  screenshot_url?: string | null;
  thumbnail_url?: string | null;
  content_url?: string | null;
};

function storedPreviewUrl(row: PublicationPreviewEmbedInput): string | null {
  return row.screenshot_url?.trim() || row.thumbnail_url?.trim() || null;
}

/**
 * Embed a campaign publication snapshot as a data URI for HTML/PDF/PPT.
 * Uses stored screenshot/thumbnail when fetchable; otherwise resolves the live
 * post via the publication-preview proxy (oEmbed / OpenGraph).
 */
export async function embedCampaignPublicationPreview(
  row: PublicationPreviewEmbedInput
): Promise<string | null> {
  const stored = storedPreviewUrl(row);
  const postUrl = row.content_url?.trim() || null;

  if (stored?.startsWith("data:")) {
    return compressExportDataUri(stored, SHOWCASE_PUBLICATION_COMPRESS);
  }

  if (stored && !shouldProxyPublicationMediaUrl(stored) && stored.includes("://")) {
    const embedded = await embedReportImageDataUri(stored);
    if (embedded?.startsWith("data:")) {
      return compressExportDataUri(embedded, SHOWCASE_PUBLICATION_COMPRESS);
    }
  }

  const socialSrc = stored && shouldProxyPublicationMediaUrl(stored) ? stored : null;
  if (socialSrc || postUrl) {
    const preview = await fetchPublicationPreviewImage({
      src: socialSrc,
      postUrl,
    });
    if (preview.ok) {
      const buffer = Buffer.from(preview.buffer);
      const contentType = preview.contentType || detectImageContentType(buffer);
      return toCompressedExportDataUri(buffer, contentType, SHOWCASE_PUBLICATION_COMPRESS);
    }
  }

  return null;
}
