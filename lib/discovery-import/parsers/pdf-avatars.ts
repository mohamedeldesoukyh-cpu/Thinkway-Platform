import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PDFParse } from "pdf-parse";

import type { EmbeddedImage } from "pdf-parse";

import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";

import type { ParsedCreatorRow } from "../types";

export type ExtractedImportAvatar = {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
  source: "pdf-crop" | "embedded";
};

/** indaHash Creator Search PDFs embed one full-page raster; avatars are cropped per row. */
const COMPOSITE_CROP = {
  tableTopRatio: 0.204,
  tableBottomRatio: 0.985,
  avatarLeftRatio: 0.042,
  avatarSizeRowRatio: 0.72,
  maxAvatarPx: 110,
  avatarColumnWidthRatio: 0.12,
  avatarScanTopRatio: 0.14,
  avatarScanBottomRatio: 0.99,
  avatarBandDensityThreshold: 0.12,
  avatarBandMinHeightPx: 40,
} as const;

const AVATAR_DEBUG_DIR = path.join(".tmp", "avatar-debug");

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

type AvatarScanContext = {
  getImageData: (
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ) => { data: ArrayLike<number> };
};

function detectCompositeAvatarCenters(
  ctx: AvatarScanContext,
  pageWidth: number,
  pageHeight: number
): number[] {
  const avatarLeft = Math.round(pageWidth * COMPOSITE_CROP.avatarLeftRatio);
  const avatarColWidth = Math.round(pageWidth * COMPOSITE_CROP.avatarColumnWidthRatio);
  const scanStart = Math.round(pageHeight * COMPOSITE_CROP.avatarScanTopRatio);
  const scanEnd = Math.round(pageHeight * COMPOSITE_CROP.avatarScanBottomRatio);

  const centers: number[] = [];
  let inBand = false;
  let bandStart = 0;

  for (let y = scanStart; y < scanEnd; y++) {
    const data = ctx.getImageData(avatarLeft, y, avatarColWidth, 1).data;
    let nonWhite = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r < 225 || g < 225 || b < 225) nonWhite++;
    }
    const density = nonWhite / (data.length / 4);
    if (density > COMPOSITE_CROP.avatarBandDensityThreshold) {
      if (!inBand) {
        inBand = true;
        bandStart = y;
      }
    } else if (inBand) {
      const bandHeight = y - bandStart;
      if (bandHeight >= COMPOSITE_CROP.avatarBandMinHeightPx) {
        centers.push(Math.round(bandStart + bandHeight / 2));
      }
      inBand = false;
    }
  }

  return centers;
}

function uniformAvatarCenterY(
  pageHeight: number,
  rowIndex: number,
  rowCount: number
): number {
  const tableTop = Math.round(pageHeight * COMPOSITE_CROP.tableTopRatio);
  const tableBottom = Math.round(pageHeight * COMPOSITE_CROP.tableBottomRatio);
  const rowHeight = (tableBottom - tableTop) / rowCount;
  return tableTop + rowHeight * rowIndex + rowHeight / 2;
}

function baseAvatarSize(pageHeight: number, rowCount: number): number {
  const tableTop = Math.round(pageHeight * COMPOSITE_CROP.tableTopRatio);
  const tableBottom = Math.round(pageHeight * COMPOSITE_CROP.tableBottomRatio);
  const rowHeight = (tableBottom - tableTop) / rowCount;
  return Math.min(
    Math.round(rowHeight * COMPOSITE_CROP.avatarSizeRowRatio),
    COMPOSITE_CROP.maxAvatarPx
  );
}

function computePortraitSquareCrop(
  pageWidth: number,
  pageHeight: number,
  centerY: number,
  avatarSize: number,
  avatarLeft: number
): { cropX: number; cropY: number; cropWidth: number; cropHeight: number } {
  const tightX = avatarLeft;
  const tightY = Math.round(centerY - avatarSize / 2);

  let cropX = Math.max(0, tightX - 15);
  let cropY = Math.max(0, tightY - 20);
  let cropWidth = avatarSize + 30;
  let cropHeight = avatarSize + 40;

  cropY = Math.max(0, cropY - cropHeight * 0.15);

  const originalCenterX = avatarLeft + avatarSize / 2;
  const originalCenterY = centerY;
  const squareSize = Math.max(cropWidth, cropHeight);

  cropX = Math.round(originalCenterX - squareSize / 2);
  cropY = Math.round(originalCenterY - squareSize / 2);
  cropY = Math.max(0, Math.round(cropY - squareSize * 0.15));
  cropWidth = squareSize;
  cropHeight = squareSize;

  if (cropX < 0) cropX = 0;
  if (cropY < 0) cropY = 0;
  if (cropX + cropWidth > pageWidth) {
    cropX = Math.max(0, pageWidth - cropWidth);
  }
  if (cropY + cropHeight > pageHeight) {
    cropY = Math.max(0, pageHeight - cropHeight);
  }
  if (cropWidth > pageWidth) cropWidth = pageWidth;
  if (cropHeight > pageHeight) cropHeight = pageHeight;

  return { cropX, cropY, cropWidth, cropHeight };
}

function logAvatarCropDebug(input: {
  username: string;
  pageWidth: number;
  pageHeight: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
}): void {
  console.log("[import] avatar crop", {
    username: input.username,
    pageWidth: input.pageWidth,
    pageHeight: input.pageHeight,
    cropX: input.cropX,
    cropY: input.cropY,
    cropWidth: input.cropWidth,
    cropHeight: input.cropHeight,
  });
}

export function logAvatarExtracted(input: {
  username: string;
  finalWidth: number;
  finalHeight: number;
  source: ExtractedImportAvatar["source"];
}): void {
  console.log("[import] avatar extracted", {
    username: input.username,
    finalWidth: input.finalWidth,
    finalHeight: input.finalHeight,
    source: input.source,
  });
}

function saveAvatarDebugCrop(username: string, buffer: Buffer): void {
  try {
    mkdirSync(AVATAR_DEBUG_DIR, { recursive: true });
    writeFileSync(path.join(AVATAR_DEBUG_DIR, `${username}.jpg`), buffer);
  } catch {
    // Local debugging only; ignore write failures in restricted environments.
  }
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
      width: image.width,
      height: image.height,
      source: "embedded",
    });
    logAvatarExtracted({
      username: row.username,
      finalWidth: image.width,
      finalHeight: image.height,
      source: "embedded",
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

  const layoutCanvas = createCanvas(pageImage.width, pageImage.height);
  const layoutCtx = layoutCanvas.getContext("2d");
  layoutCtx.drawImage(source, 0, 0);

  const detectedCenters = detectCompositeAvatarCenters(
    layoutCtx,
    pageImage.width,
    pageImage.height
  );
  const useDetectedCenters = detectedCenters.length === rows.length;

  const avatarSize = baseAvatarSize(pageImage.height, rows.length);
  const avatarLeft = Math.round(pageImage.width * COMPOSITE_CROP.avatarLeftRatio);

  const result = new Map<string, ExtractedImportAvatar>();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row) continue;

    const centerY = useDetectedCenters
      ? detectedCenters[index]!
      : uniformAvatarCenterY(pageImage.height, index, rows.length);

    const { cropX, cropY, cropWidth, cropHeight } = computePortraitSquareCrop(
      pageImage.width,
      pageImage.height,
      centerY,
      avatarSize,
      avatarLeft
    );

    logAvatarCropDebug({
      username: row.username,
      pageWidth: pageImage.width,
      pageHeight: pageImage.height,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
    });

    const crop = createCanvas(cropWidth, cropHeight);
    const cropCtx = crop.getContext("2d");
    cropCtx.drawImage(
      source,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );
    const buffer = Buffer.from(crop.toBuffer("image/jpeg"));
    saveAvatarDebugCrop(row.username, buffer);

    const extracted: ExtractedImportAvatar = {
      buffer,
      contentType: "image/jpeg",
      width: cropWidth,
      height: cropHeight,
      source: "pdf-crop",
    };
    result.set(row.username.toLowerCase(), extracted);
    logAvatarExtracted({
      username: row.username,
      finalWidth: extracted.width,
      finalHeight: extracted.height,
      source: extracted.source,
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
