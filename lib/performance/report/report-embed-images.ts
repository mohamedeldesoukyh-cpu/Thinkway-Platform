import {
  detectImageContentType,
  fetchImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";

const dataUriCache = new Map<string, string>();

/** Fetch remote image and return a data URI for PDF-safe report embedding. */
export async function embedReportImageDataUri(
  url: string | null | undefined
): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed;

  const cached = dataUriCache.get(trimmed);
  if (cached) return cached;

  const buffer = await fetchImageBuffer(trimmed);
  if (!buffer) return trimmed;

  const contentType = detectImageContentType(buffer);
  const dataUri = `data:${contentType};base64,${buffer.toString("base64")}`;
  dataUriCache.set(trimmed, dataUri);
  return dataUri;
}
