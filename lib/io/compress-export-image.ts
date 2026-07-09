/**
 * Compress / resize images before embedding as data URIs in HTML exports (PDF/preview).
 * Prefers sharp when available; falls back to @napi-rs/canvas.
 */

export type CompressExportImageOptions = {
  /** Longest edge in CSS pixels (before retina). */
  maxEdge: number;
  /** JPEG quality 1–100. */
  quality?: number;
};

function parseDataUri(dataUri: string): { contentType: string; buffer: Buffer } | null {
  const trimmed = dataUri.trim();
  if (!trimmed.startsWith("data:")) return null;
  const comma = trimmed.indexOf(",");
  if (comma < 0) return null;
  const meta = trimmed.slice(5, comma);
  const payload = trimmed.slice(comma + 1);
  if (!meta.endsWith(";base64")) return null;
  const contentType = meta.slice(0, -";base64".length);
  if (!contentType || contentType.includes(";")) return null;
  try {
    return { contentType, buffer: Buffer.from(payload, "base64") };
  } catch {
    return null;
  }
}

async function compressWithSharp(
  buffer: Buffer,
  options: CompressExportImageOptions
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const quality = options.quality ?? 72;
    const out = await sharp(buffer)
      .rotate()
      .resize({
        width: options.maxEdge,
        height: options.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return { buffer: out, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

async function compressWithCanvas(
  buffer: Buffer,
  options: CompressExportImageOptions
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const image = await loadImage(buffer);
    const maxEdge = options.maxEdge;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, width, height);
    const quality = (options.quality ?? 72) / 100;
    return {
      buffer: Buffer.from(canvas.toBuffer("image/jpeg", quality)),
      contentType: "image/jpeg",
    };
  } catch {
    return null;
  }
}

/** Resize and re-encode a raw image buffer as JPEG for compact data-URI embeds. */
export async function compressExportImageBuffer(
  buffer: Buffer,
  options: CompressExportImageOptions
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const compressed =
    (await compressWithSharp(buffer, options)) ??
    (await compressWithCanvas(buffer, options));
  return compressed;
}

/** Compress a data URI in-place; returns original when parsing/compression fails. */
export async function compressExportDataUri(
  dataUri: string,
  options: CompressExportImageOptions
): Promise<string> {
  const parsed = parseDataUri(dataUri);
  if (!parsed) return dataUri;

  const compressed = await compressExportImageBuffer(parsed.buffer, options);
  if (!compressed) return dataUri;
  const next = `data:${compressed.contentType};base64,${compressed.buffer.toString("base64")}`;
  return next.length < dataUri.length ? next : dataUri;
}

/** Build a compressed JPEG data URI from a raw image buffer (falls back to original encoding). */
export async function toCompressedExportDataUri(
  buffer: Buffer,
  contentType: string,
  options: CompressExportImageOptions
): Promise<string> {
  const compressed = await compressExportImageBuffer(buffer, options);
  if (compressed) {
    return `data:${compressed.contentType};base64,${compressed.buffer.toString("base64")}`;
  }
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export const SHOWCASE_AVATAR_COMPRESS: CompressExportImageOptions = {
  maxEdge: 192,
  quality: 70,
};

export const SHOWCASE_PUBLICATION_COMPRESS: CompressExportImageOptions = {
  maxEdge: 640,
  quality: 68,
};
