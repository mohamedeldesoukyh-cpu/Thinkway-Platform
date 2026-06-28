import { PDFParse } from "pdf-parse";

import type { EmbeddedImage } from "pdf-parse";

import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";

import type { ParsedCreatorRow } from "../types";

export type ExtractedImportAvatar = {
  buffer: Buffer;
  contentType: string;
};

/** indaHash Creator Search PDFs embed one full-page raster; avatars are cropped per row. */
const COMPOSITE_CROP = {
  tableTopRatio: 0.204,
  tableBottomRatio: 0.985,
  avatarLeftRatio: 0.042,
  avatarSizeRowRatio: 0.72,
  maxAvatarPx: 110,
} as const;

function isLikelyProfileEmbeddedImage(image: EmbeddedImage): boolean {
  const minSide = Math.min(image.width, image.height);
  const maxSide = Math.max(image.width, image.height);
  if (minSide < 40 || maxSide > 220) return false;
  const aspect = image.width / image.height;
  return aspect >= 0.75 && aspect <= 1.35;
}

function pickCompositePageImage(images: EmbeddedImage[]): EmbeddedImage | null {
  if (images.length === 0) return null;
  return [...images].sort((a, b) => b.width * b.height - a.width * a.height)[0] ?? null;
}

function avatarBuffersFromEmbeddedImages(
  images: EmbeddedImage[],
  rows: ParsedCreatorRow[]
): Map<string, ExtractedImportAvatar> {
  const profileImages = images.filter(isLikelyProfileEmbeddedImage);
  if (profileImages.length < Math.max(1, Math.floor(rows.length * 0.5))) {
    return new Map();
  }

  const result = new Map<string, ExtractedImportAvatar>();
  for (let index = 0; index < rows.length && index < profileImages.length; index++) {
    const row = rows[index];
    const image = profileImages[index];
    if (!row || !image?.data?.length) continue;
    const buffer = Buffer.from(image.data);
    result.set(row.username.toLowerCase(), {
      buffer,
      contentType: detectImageContentType(buffer),
    });
  }
  return result;
}

async function avatarBuffersFromCompositePage(
  pageImage: EmbeddedImage,
  rows: ParsedCreatorRow[]
): Promise<Map<string, ExtractedImportAvatar>> {
  if (rows.length === 0 || !pageImage.data?.length) return new Map();

  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const source = await loadImage(Buffer.from(pageImage.data));

  const tableTop = Math.round(pageImage.height * COMPOSITE_CROP.tableTopRatio);
  const tableBottom = Math.round(pageImage.height * COMPOSITE_CROP.tableBottomRatio);
  const rowHeight = (tableBottom - tableTop) / rows.length;
  const avatarSize = Math.min(
    Math.round(rowHeight * COMPOSITE_CROP.avatarSizeRowRatio),
    COMPOSITE_CROP.maxAvatarPx
  );
  const avatarLeft = Math.round(pageImage.width * COMPOSITE_CROP.avatarLeftRatio);

  const result = new Map<string, ExtractedImportAvatar>();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row) continue;

    const centerY = tableTop + rowHeight * index + rowHeight / 2;
    const top = Math.round(centerY - avatarSize / 2);
    const crop = createCanvas(avatarSize, avatarSize);
    const cropCtx = crop.getContext("2d");
    cropCtx.drawImage(
      source,
      avatarLeft,
      top,
      avatarSize,
      avatarSize,
      0,
      0,
      avatarSize,
      avatarSize
    );
    const buffer = Buffer.from(crop.toBuffer("image/png"));
    result.set(row.username.toLowerCase(), {
      buffer,
      contentType: "image/png",
    });
  }

  return result;
}

/**
 * Extract profile photo bytes from an indaHash-style PDF export.
 * Handles per-row embedded images and full-page composite screenshots.
 */
export async function extractPdfCreatorAvatarBuffers(
  buffer: Buffer,
  rows: ParsedCreatorRow[]
): Promise<Map<string, ExtractedImportAvatar>> {
  if (rows.length === 0) return new Map();

  const parser = new PDFParse({ data: buffer });
  try {
    const imageResult = await parser.getImage({
      imageThreshold: 20,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const allImages = imageResult.pages.flatMap((page) => page.images);
    const fromEmbedded = avatarBuffersFromEmbeddedImages(allImages, rows);
    if (fromEmbedded.size > 0) {
      return fromEmbedded;
    }

    const composite = pickCompositePageImage(allImages);
    if (!composite) return new Map();

    return avatarBuffersFromCompositePage(composite, rows);
  } finally {
    await parser.destroy();
  }
}

export function logPdfAvatarExtraction(
  username: string,
  extracted: boolean
): void {
  console.log(`[import] extracted avatar for ${username}: ${extracted}`);
}
