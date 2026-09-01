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
    const out = await sharp(buffer, { failOn: "truncated" })
      .rotate()
      .resize({
        width: options.maxEdge,
        height: options.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .toColorspace("srgb")
      .jpeg({ quality, chromaSubsampling: "4:4:4" })
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

/**
 * False for truncated JPEG/PNG/WebP payloads. Incomplete files still report a
 * full width in metadata, then decode as posterized/blocky tiles in preview.
 */
export function imageBufferLooksComplete(buffer: Buffer | ArrayBuffer): boolean {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.byteLength < 24) return false;

  if (buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = buf.length - 2; i >= Math.max(0, buf.length - 16); i--) {
      if (buf[i] === 0xff && buf[i + 1] === 0xd9) return true;
    }
    return false;
  }

  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return buf.includes(Buffer.from("IEND"));
  }

  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.byteLength >= 8
  ) {
    const declared = buf.readUInt32LE(4);
    return Number.isFinite(declared) && buf.byteLength >= declared + 8;
  }

  return true;
}

/** Longest pixel edge of an image buffer; 0 when metadata cannot be read. */
export async function imageLongestEdge(buffer: Buffer | ArrayBuffer): Promise<number> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  // Truncated stubs (e.g. 4-byte SOI/EOI) abort sharp's native decoder — skip them.
  if (buf.byteLength < 128) return 0;

  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf, { failOn: "truncated" }).metadata();
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

/** IJG Annex K luminance quantization table (quality 50). */
const JPEG_STD_LUMINANCE_QUANT = [
  16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69,
  56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81,
  104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99,
];

/**
 * Estimate JPEG quality (1–100) from the luminance DQT. Independent of pixel
 * content, so a solid q90 JPEG is not confused with an Instagram e15 preview.
 */
export function jpegQualityEstimate(buffer: Buffer | ArrayBuffer): number | null {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (buf.byteLength < 128 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;

  let i = 2;
  while (i + 3 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x00 || marker === 0xff || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 1;
      continue;
    }
    if (i + 3 >= buf.length) break;
    const length = buf.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > buf.length) break;
    if (marker === 0xdb) {
      let offset = i + 4;
      const end = i + 2 + length;
      while (offset + 65 <= end) {
        const info = buf[offset];
        const precision = info >> 4;
        const tableId = info & 0x0f;
        offset += 1;
        const tableSize = precision === 1 ? 128 : 64;
        if (offset + tableSize > end) break;
        if (precision === 0 && tableId === 0) {
          let scaleSum = 0;
          for (let q = 0; q < 64; q++) {
            const std = JPEG_STD_LUMINANCE_QUANT[q] ?? 16;
            scaleSum += buf[offset + q] / std;
          }
          const scale = (scaleSum / 64) * 100;
          const quality =
            scale <= 0 ? 100 : scale > 100 ? 5000 / scale : (200 - scale) / 2;
          return Math.max(1, Math.min(100, Math.round(quality)));
        }
        offset += tableSize;
      }
    }
    i += 2 + length;
  }
  return null;
}

/** Instagram `e15` / JPEG quality below this looks posterized in Showcase tiles. */
export const MIN_PHOTOGRAPHIC_JPEG_QUALITY = 32;

/** True when JPEG quantization matches Instagram e15-class posterization. */
export function isVisiblyOvercompressedPhoto(buffer: Buffer | ArrayBuffer): boolean {
  const quality = jpegQualityEstimate(buffer);
  return quality != null && quality < MIN_PHOTOGRAPHIC_JPEG_QUALITY;
}

/** True when a buffer is a real image large enough to display without looking pixelated. */
export async function exportImageBufferMeetsMinEdge(
  buffer: Buffer | ArrayBuffer,
  minEdge: number
): Promise<boolean> {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (!imageBufferLooksComplete(buf)) return false;
  const edge = await imageLongestEdge(buf);
  if (edge === 0) return false;
  return !isVisiblyLowResolutionImage(edge, minEdge);
}

/** Showcase publication tiles (~200–280 CSS px) look pixelated below this source size. */
export const MIN_SHARP_PUBLICATION_EDGE = 640;

/** Showcase avatars are 88 CSS px; below this source size they look soft on retina. */
export const MIN_SHARP_AVATAR_EDGE = 280;

/** Hard floor — smaller than this is visibly pixelated at quotation avatar size. */
export const MIN_DISPLAYABLE_AVATAR_EDGE = 160;

/** Hard floor — smaller than this is visibly pixelated in Showcase publication tiles. */
export const MIN_DISPLAYABLE_PUBLICATION_EDGE = 240;

/** Resize and re-encode a raw image buffer as JPEG for compact data-URI embeds. */
export async function compressExportImageBuffer(
  buffer: Buffer,
  options: CompressExportImageOptions
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!imageBufferLooksComplete(buffer)) return null;
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

export const SHOWCASE_PUBLICATION_COMPRESS: CompressExportImageOptions = {
  maxEdge: 1080,
  quality: 90,
};
