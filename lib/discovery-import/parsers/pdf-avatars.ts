import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { PDFParse } from "pdf-parse";

import type { EmbeddedImage } from "pdf-parse";

import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";

import type { Canvas, SKRSContext2D } from "@napi-rs/canvas";

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
  cropZoomInFactor: 1.6,
  /** Shift crop window right so faces sit centered in the circular UI frame. */
  cropCenterOffsetRightRatio: 0.12,
  minCropPx: 80,
  avatarColumnWidthRatio: 0.12,
  avatarScanTopRatio: 0.14,
  avatarScanBottomRatio: 0.99,
  avatarBandDensityThreshold: 0.12,
  avatarBandMinHeightPx: 40,
  /** Reject composite crops above this white ratio — leaves URL empty for Apify/OG enrichment. */
  maxCropWhiteRatio: 0.72,
} as const;

const AVATAR_DEBUG_DIR = path.join(".tmp", "avatar-debug");

function importAvatarDebugLog(message: string, details?: Record<string, unknown>): void {
  if (process.env.NODE_ENV === "production") return;
  if (details) {
    console.log(message, details);
    return;
  }
  console.log(message);
}

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

/** Full-page raster screenshots — one per PDF page in multi-page exports. */
function listCompositePageImages(pages: Array<{ images: EmbeddedImage[] }>): EmbeddedImage[] {
  return pages
    .map((page) => pickCompositePageImage(page.images))
    .filter((image): image is EmbeddedImage => Boolean(image?.data?.length));
}

/** Split import rows across page composites using detected avatar band counts per page. */
export function splitImportRowsAcrossPages(
  rows: ParsedCreatorRow[],
  bandCountsPerPage: number[]
): ParsedCreatorRow[][] {
  if (rows.length === 0 || bandCountsPerPage.length === 0) return [];

  const counts = [...bandCountsPerPage];
  let totalBands = counts.reduce((sum, count) => sum + count, 0);

  if (totalBands === 0) {
    const perPage = Math.ceil(rows.length / counts.length);
    for (let i = 0; i < counts.length; i++) {
      counts[i] = Math.min(perPage, Math.max(0, rows.length - i * perPage));
    }
    totalBands = counts.reduce((sum, count) => sum + count, 0);
  }

  while (totalBands > rows.length) {
    const idx = counts.indexOf(Math.max(...counts));
    counts[idx]! -= 1;
    totalBands -= 1;
  }
  while (totalBands < rows.length) {
    counts[counts.length - 1]! += 1;
    totalBands += 1;
  }

  const chunks: ParsedCreatorRow[][] = [];
  let offset = 0;
  for (const count of counts) {
    if (count <= 0) continue;
    chunks.push(rows.slice(offset, offset + count));
    offset += count;
  }
  return chunks;
}

/** Fraction of pixels brighter than threshold — used to reject empty PDF crops. */
export function measureRgbaWhiteRatio(
  data: ArrayLike<number>,
  pixelCount: number,
  threshold = 240
): number {
  if (pixelCount <= 0) return 1;
  let white = 0;
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    if (data[offset]! > threshold && data[offset + 1]! > threshold && data[offset + 2]! > threshold) {
      white++;
    }
  }
  return white / pixelCount;
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
  const finalCropSize = Math.max(
    COMPOSITE_CROP.minCropPx,
    Math.round(squareSize / COMPOSITE_CROP.cropZoomInFactor)
  );

  const adjustedCenterX =
    originalCenterX + finalCropSize * COMPOSITE_CROP.cropCenterOffsetRightRatio;
  cropX = Math.round(adjustedCenterX - finalCropSize / 2);
  cropY = Math.round(originalCenterY - finalCropSize / 2);
  cropY = Math.max(0, Math.round(cropY - finalCropSize * 0.15));
  cropWidth = finalCropSize;
  cropHeight = finalCropSize;

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
  importAvatarDebugLog("[import] avatar crop", {
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
  importAvatarDebugLog("[import] avatar extracted", {
    username: input.username,
    finalWidth: input.finalWidth,
    finalHeight: input.finalHeight,
    source: input.source,
  });
}

function saveAvatarDebugCrop(username: string, buffer: Buffer): void {
  if (process.env.NODE_ENV === "production") return;
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

type CropCanvas = Canvas;

type RenderedAvatarCrop = {
  buffer: Buffer;
  width: number;
  height: number;
  whiteRatio: number;
};

function measureBufferWhiteRatio(
  createCanvas: typeof import("@napi-rs/canvas").createCanvas,
  loadImage: typeof import("@napi-rs/canvas").loadImage,
  buffer: Buffer
): Promise<number> {
  return loadImage(buffer).then((img) => {
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, img.width, img.height);
    return measureRgbaWhiteRatio(data, img.width * img.height);
  });
}

function finalizeCompositeCropBuffer(
  cropCanvas: CropCanvas,
  cropCtx: SKRSContext2D,
  createCanvas: typeof import("@napi-rs/canvas").createCanvas,
  cropWidth: number,
  cropHeight: number
): { buffer: Buffer; width: number; height: number } {
  const threshold = 235;
  const imageData = cropCtx.getImageData(0, 0, cropWidth, cropHeight);
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r < threshold || g < threshold || b < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX >= minX) {
    const contentW = maxX - minX + 1;
    const contentH = maxY - minY + 1;
    const squareSize = Math.max(contentW, contentH);
    const centerX = minX + contentW / 2;
    const contentCenterY = minY + contentH / 2;

    let sqX = Math.round(centerX - squareSize / 2);
    let sqY = Math.round(contentCenterY - squareSize / 2);
    sqX = Math.max(0, Math.min(sqX, cropWidth - squareSize));
    sqY = Math.max(0, Math.min(sqY, cropHeight - squareSize));
    let finalSize = squareSize;
    if (sqX + finalSize > cropWidth) finalSize = cropWidth - sqX;
    if (sqY + finalSize > cropHeight) finalSize = cropHeight - sqY;

    const trimmed = createCanvas(finalSize, finalSize);
    const trimmedCtx = trimmed.getContext("2d");
    trimmedCtx.drawImage(
      cropCanvas as never,
      sqX,
      sqY,
      finalSize,
      finalSize,
      0,
      0,
      finalSize,
      finalSize
    );
    return {
      buffer: Buffer.from(trimmed.toBuffer("image/jpeg")),
      width: finalSize,
      height: finalSize,
    };
  }

  return {
    buffer: Buffer.from(cropCanvas.toBuffer("image/jpeg")),
    width: cropWidth,
    height: cropHeight,
  };
}

async function renderCompositeAvatarCrop(input: {
  source: Awaited<ReturnType<typeof import("@napi-rs/canvas").loadImage>>;
  pageWidth: number;
  pageHeight: number;
  centerY: number;
  avatarSize: number;
  avatarLeft: number;
  createCanvas: typeof import("@napi-rs/canvas").createCanvas;
  loadImage: typeof import("@napi-rs/canvas").loadImage;
}): Promise<RenderedAvatarCrop | null> {
  const { cropX, cropY, cropWidth, cropHeight } = computePortraitSquareCrop(
    input.pageWidth,
    input.pageHeight,
    input.centerY,
    input.avatarSize,
    input.avatarLeft
  );

  const crop = input.createCanvas(cropWidth, cropHeight);
  const cropCtx = crop.getContext("2d");
  cropCtx.drawImage(
    input.source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );

  const finalized = finalizeCompositeCropBuffer(
    crop,
    cropCtx,
    input.createCanvas,
    cropWidth,
    cropHeight
  );
  const whiteRatio = await measureBufferWhiteRatio(
    input.createCanvas,
    input.loadImage,
    finalized.buffer
  );
  if (whiteRatio > COMPOSITE_CROP.maxCropWhiteRatio) {
    return null;
  }
  return { ...finalized, whiteRatio };
}

function candidateCenterYs(
  pageHeight: number,
  rowIndex: number,
  rowCount: number,
  detectedCenters: number[]
): number[] {
  const uniform = uniformAvatarCenterY(pageHeight, rowIndex, rowCount);
  const detected = detectedCenters[rowIndex];
  const candidates: number[] = [];
  if (detected != null) candidates.push(detected);
  if (!candidates.includes(uniform)) candidates.push(uniform);
  return candidates;
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

  const avatarSize = baseAvatarSize(pageImage.height, rows.length);
  const avatarLeft = Math.round(pageImage.width * COMPOSITE_CROP.avatarLeftRatio);

  const result = new Map<string, ExtractedImportAvatar>();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row) continue;

    let best: RenderedAvatarCrop | null = null;
    for (const centerY of candidateCenterYs(
      pageImage.height,
      index,
      rows.length,
      detectedCenters
    )) {
      const rendered = await renderCompositeAvatarCrop({
        source,
        pageWidth: pageImage.width,
        pageHeight: pageImage.height,
        centerY,
        avatarSize,
        avatarLeft,
        createCanvas,
        loadImage,
      });
      if (!rendered) continue;
      if (!best || rendered.whiteRatio < best.whiteRatio) {
        best = rendered;
      }
    }

    if (!best) {
      importAvatarDebugLog("[import] avatar crop rejected", {
        username: row.username,
        reason: "mostly_empty",
      });
      continue;
    }

    const { cropX, cropY, cropWidth, cropHeight } = computePortraitSquareCrop(
      pageImage.width,
      pageImage.height,
      candidateCenterYs(pageImage.height, index, rows.length, detectedCenters)[0]!,
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

    saveAvatarDebugCrop(row.username, best.buffer);

    const extracted: ExtractedImportAvatar = {
      buffer: best.buffer,
      contentType: "image/jpeg",
      width: best.width,
      height: best.height,
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

async function countAvatarBandsOnPage(pageImage: EmbeddedImage): Promise<number> {
  if (!pageImage.data?.length) return 0;
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const source = await loadImage(Buffer.from(pageImage.data));
  const canvas = createCanvas(pageImage.width, pageImage.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);
  return detectCompositeAvatarCenters(ctx, pageImage.width, pageImage.height).length;
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

    const pageComposites = listCompositePageImages(imageResult.pages);
    if (pageComposites.length === 0) return new Map();

    if (pageComposites.length === 1) {
      return avatarBuffersFromCompositePage(pageComposites[0]!, rows);
    }

    const bandCounts = await Promise.all(pageComposites.map((page) => countAvatarBandsOnPage(page)));
    const rowChunks = splitImportRowsAcrossPages(rows, bandCounts);
    const merged = new Map<string, ExtractedImportAvatar>();

    for (let pageIndex = 0; pageIndex < pageComposites.length; pageIndex++) {
      const pageRows = rowChunks[pageIndex];
      const pageImage = pageComposites[pageIndex];
      if (!pageRows?.length || !pageImage) continue;
      const pageAvatars = await avatarBuffersFromCompositePage(pageImage, pageRows);
      for (const [key, value] of pageAvatars) {
        merged.set(key, value);
      }
    }

    return merged;
  } finally {
    await parser.destroy();
  }
}

export function logPdfAvatarExtraction(
  username: string,
  extracted: boolean
): void {
  importAvatarDebugLog(`[import] extracted avatar for ${username}: ${extracted}`);
}
