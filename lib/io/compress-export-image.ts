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

/** Longest pixel edge of an image buffer; 0 when metadata cannot be read. */
export async function imageLongestEdge(buffer: Buffer | ArrayBuffer): Promise<number> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  // Truncated stubs (e.g. 4-byte SOI/EOI) abort sharp's native decoder — skip them.
  if (buf.byteLength < 128) return 0;

  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf).metadata();
    return Math.max(meta.width ?? 0, meta.height ?? 0);
  } catch {
    // fall through to canvas
  }

  try {
    const { loadImage } = await import("@napi-rs/canvas");
    const image = await loadImage(buf);
    return Math.max(image.width, image.height);
  } catch {
    return 0;
  }
}

/** True when we measured a real image that is too small to look sharp when stretched. */
export function isVisiblyLowResolutionImage(edge: number, minEdge: number): boolean {
  return edge > 0 && edge < minEdge;
}

/** Showcase publication tiles (~200–280 CSS px) look pixelated below this source size. */
export const MIN_SHARP_PUBLICATION_EDGE = 640;

/** Showcase avatars are 88 CSS px; below this source size they look soft on retina. */
export const MIN_SHARP_AVATAR_EDGE = 280;

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
  maxEdge: 512,
  quality: 86,
};

/** Higher-res avatars for pitch presentation decks (large hero portraits). */
export const PITCH_AVATAR_COMPRESS: CompressExportImageOptions = {
  maxEdge: 720,
  quality: 88,
};

export const SHOWCASE_PUBLICATION_COMPRESS: CompressExportImageOptions = {
  maxEdge: 1080,
  quality: 82,
};

export type CropExportImageCoverOptions = {
  aspectW: number;
  aspectH: number;
  /** Longest edge of the cropped output in pixels. */
  maxEdge?: number;
  quality?: number;
};

async function cropWithSharp(
  buffer: Buffer,
  options: CropExportImageCoverOptions
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const sharp = (await import("sharp")).default;
    const { aspectW, aspectH, maxEdge = 720, quality = 78 } = options;
    const ratio = aspectW / aspectH;
    let width: number;
    let height: number;
    if (ratio >= 1) {
      width = Math.max(1, Math.round(maxEdge));
      height = Math.max(1, Math.round(maxEdge / ratio));
    } else {
      height = Math.max(1, Math.round(maxEdge));
      width = Math.max(1, Math.round(maxEdge * ratio));
    }

    const out = await sharp(buffer)
      .rotate()
      .resize(width, height, { fit: "cover", position: "centre" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    return { buffer: out, contentType: "image/jpeg" };
  } catch {
    return null;
  }
}

async function cropWithCanvas(
  buffer: Buffer,
  options: CropExportImageCoverOptions
): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const { aspectW, aspectH, maxEdge = 720, quality = 78 } = options;
    const ratio = aspectW / aspectH;
    const image = await loadImage(buffer);
    const imgRatio = image.width / image.height;

    let sourceW: number;
    let sourceH: number;
    let sourceX: number;
    let sourceY: number;
    if (imgRatio > ratio) {
      sourceH = image.height;
      sourceW = sourceH * ratio;
      sourceX = (image.width - sourceW) / 2;
      sourceY = 0;
    } else {
      sourceW = image.width;
      sourceH = sourceW / ratio;
      sourceX = 0;
      sourceY = (image.height - sourceH) / 2;
    }

    let width: number;
    let height: number;
    if (ratio >= 1) {
      width = Math.max(1, Math.round(maxEdge));
      height = Math.max(1, Math.round(maxEdge / ratio));
    } else {
      height = Math.max(1, Math.round(maxEdge));
      width = Math.max(1, Math.round(maxEdge * ratio));
    }

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, width, height);
    return {
      buffer: Buffer.from(canvas.toBuffer("image/jpeg", quality / 100)),
      contentType: "image/jpeg",
    };
  } catch {
    return null;
  }
}

/** Center-crop to an aspect ratio (e.g. 1×1 showcase tiles). Used when PPTX embed cannot crop. */
export async function cropExportImageBufferCover(
  buffer: Buffer,
  options: CropExportImageCoverOptions
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const { aspectW, aspectH } = options;
  if (aspectW <= 0 || aspectH <= 0 || !buffer.length) return null;

  return (await cropWithSharp(buffer, options)) ?? (await cropWithCanvas(buffer, options));
}
