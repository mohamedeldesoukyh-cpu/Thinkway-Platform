import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  detectImageContentType,
  fetchImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";

/** Design tokens — matched to Thinkway QT-2026-0020 Redesign deck. */
export const TW_BLUE = "0057FF";
export const TW_NAVY = "0D1836";
export const TW_TITLE_INK = "0D1220";
export const TW_MUTED = "7C88A4";
export const TW_MUTED_SOFT = "9AA3B5";
export const TW_FOOTER_MUTED = "9AA3B5";
export const TW_COVER_FOOTER = "8FA3D0";
export const TW_COVER_KICKER = "CBDCFF";
export const TW_COVER_META = "9FB6E8";
export const TW_COVER_STAT_LABEL = "BFD2FF";
export const TW_HAIR = "EEF1F9";
export const TW_ROW_HAIR = "EEF1F9";
export const TW_INSIGHT_BG = "F6F8FF";
export const TW_LAVENDER = "F6F8FF";
export const TW_LAV_LINE = "E6ECFB";
export const TW_WHITE = "FFFFFF";
export const TW_GREEN = "1D9E75";
export const TW_PILL = "EEF3FF";
export const TW_TINT = "F6F8FF";
export const TW_BORDER = "E6ECFB";

export const TW_FONT_UI = "Segoe UI";
export const TW_FONT_BODY = "Segoe UI";

/** Standard 16:9 presentation (mirrors Redesign_3.pptx proportions). */
export const TW_PAGE_W = 13.333;
export const TW_PAGE_H = 7.5;
export const TW_MARGIN_X = 0.6;
export const TW_CONTENT_W = TW_PAGE_W - TW_MARGIN_X * 2;
export const TW_FOOTER_Y = 7.0;
export const TW_CONTENT_BOTTOM = 6.85;
export const TW_GAP_SM = 0.1;
export const TW_GAP_MD = 0.14;
export const TW_PUB_GAP = 0.1;
export const TW_PUB_COLS = 4;
export const TW_PUB_THUMB_SIZE = 1.22;
export const TW_FOOTER_LEFT = "Thinkway · hello@thinkwaymedia.com";

export const TW_GLASS_CARD_TRANSPARENCY = 87;
export const TW_COVER_CHIP_TRANSPARENCY = 82;
export const TW_COVER_STAT_TRANSPARENCY = 88;

const PPTX_ASSET_DIR = join(process.cwd(), "features/quotations/export/assets");
const pptxBgCache = new Map<string, string>();

export type ThinkwayPptxGen = InstanceType<typeof import("pptxgenjs").default>;
export type ThinkwaySlide = ReturnType<ThinkwayPptxGen["addSlide"]>;
export type ThinkwaySlideCounter = { n: number };

export type ThinkwayPublicationShot = {
  imageUrl: string;
  isVideo?: boolean;
};

export function thinkwayPptxBackgroundData(fileName: string): string {
  const cached = pptxBgCache.get(fileName);
  if (cached) return cached;
  const data = readFileSync(join(PPTX_ASSET_DIR, fileName)).toString("base64");
  pptxBgCache.set(fileName, data);
  return data;
}

export function applyThinkwayCoverBackground(slide: ThinkwaySlide): void {
  slide.background = { data: thinkwayPptxBackgroundData("pptx-cover-bg.png") };
}

export function applyThinkwayContentBackground(slide: ThinkwaySlide): void {
  slide.background = { data: thinkwayPptxBackgroundData("pptx-content-bg.png") };
}

export function applyThinkwayClosingBackground(slide: ThinkwaySlide): void {
  slide.background = { data: thinkwayPptxBackgroundData("pptx-closing-bg.png") };
}

export function nextThinkwaySlideNo(counter: ThinkwaySlideCounter): string {
  counter.n += 1;
  return String(counter.n).padStart(2, "0");
}

export function addThinkwayLogoMark(
  slide: ThinkwaySlide,
  x: number,
  y: number,
  size: number,
  variant: "light" | "dark" = "dark"
): void {
  const markFill = variant === "light" ? TW_WHITE : TW_NAVY;
  const dotA = variant === "light" ? TW_NAVY : TW_WHITE;
  slide.addShape("roundRect", {
    x,
    y,
    w: size,
    h: size,
    fill: { color: markFill },
    line: { type: "none" },
    rectRadius: size * 0.28,
  });
  slide.addShape("ellipse", {
    x: x + size * 0.18,
    y: y + size * 0.18,
    w: size * 0.28,
    h: size * 0.28,
    fill: { color: dotA },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: x + size * 0.45,
    y: y + size * 0.45,
    w: size * 0.38,
    h: size * 0.38,
    fill: { color: TW_BLUE },
    line: { type: "none" },
  });
}

export function addThinkwayWordmark(
  slide: ThinkwaySlide,
  x: number,
  y: number,
  variant: "light" | "dark" = "dark",
  fontSize = 14
): void {
  const thinkColor = variant === "light" ? TW_WHITE : TW_NAVY;
  slide.addText(
    [
      { text: "THINK", options: { color: thinkColor, bold: true, fontSize } },
      { text: "WAY", options: { color: TW_BLUE, bold: true, fontSize } },
    ],
    {
      x,
      y,
      w: 1.7,
      h: 0.4,
      fontFace: TW_FONT_UI,
    }
  );
}

export function addThinkwayBrandLockup(
  slide: ThinkwaySlide,
  variant: "light" | "dark" = "dark",
  markY = 0.42,
  wordY = 0.37
): void {
  addThinkwayLogoMark(slide, TW_MARGIN_X, markY, 0.3, variant);
  addThinkwayWordmark(slide, 0.98, wordY, variant, 14);
}

export function addThinkwaySectionHeader(
  slide: ThinkwaySlide,
  sectionLabel: string,
  title: string
): number {
  addThinkwayBrandLockup(slide, "dark", 0.42, 0.37);
  slide.addText(sectionLabel, {
    x: TW_MARGIN_X,
    y: 1.02,
    w: 11,
    h: 0.24,
    fontFace: TW_FONT_UI,
    fontSize: 10.5,
    bold: true,
    color: TW_BLUE,
    charSpacing: 1.8,
  });
  slide.addText(title, {
    x: 0.58,
    y: 1.28,
    w: 11.5,
    h: 0.6,
    fontFace: TW_FONT_UI,
    fontSize: 24,
    bold: true,
    color: TW_TITLE_INK,
  });
  return 1.9;
}

export function addThinkwaySlideFooter(
  slide: ThinkwaySlide,
  right: string,
  pageNo: string,
  opts?: { left?: string; color?: string; y?: number }
): void {
  const y = opts?.y ?? TW_FOOTER_Y;
  const color = opts?.color ?? TW_FOOTER_MUTED;
  const left = opts?.left ?? TW_FOOTER_LEFT;
  slide.addText(left, {
    x: TW_MARGIN_X,
    y,
    w: 7,
    h: 0.3,
    fontFace: TW_FONT_UI,
    fontSize: 9,
    color,
  });
  slide.addText(right, {
    x: 8,
    y,
    w: 4.2,
    h: 0.3,
    fontFace: TW_FONT_UI,
    fontSize: 9,
    color,
    align: "right",
  });
  slide.addText(pageNo, {
    x: 12.35,
    y,
    w: 0.4,
    h: 0.3,
    fontFace: TW_FONT_UI,
    fontSize: 9,
    color,
    align: "right",
  });
}

export async function thinkwayImageBufferForPptx(
  src: string | null | undefined,
  profileUrl?: string | null
): Promise<Buffer | null> {
  const trimmed = src?.trim();
  if (trimmed?.startsWith("data:")) {
    const payload = trimmed.slice("data:".length);
    const base64Marker = ";base64,";
    const markerIndex = payload.indexOf(base64Marker);
    if (markerIndex < 0) return null;
    try {
      return Buffer.from(payload.slice(markerIndex + base64Marker.length), "base64");
    } catch {
      return null;
    }
  }

  // Prefer creator-avatar proxy path so Instagram/TikTok CDN avatars resolve
  // the same way Discovery / shortlist do (direct CDN fetch often fails in PPTX).
  if (trimmed || profileUrl?.trim()) {
    try {
      const { fetchCreatorAvatarImage } = await import(
        "@/lib/creators/creator-avatar-proxy"
      );
      const result = await fetchCreatorAvatarImage({
        src: trimmed || null,
        profileUrl: profileUrl?.trim() || null,
      });
      if (result.ok && result.buffer.byteLength > 0) {
        return Buffer.from(result.buffer);
      }
    } catch {
      // Fall through to direct fetch.
    }
  }

  if (!trimmed) return null;
  return fetchImageBuffer(trimmed);
}

export async function thinkwayImageDataForPptxOriginal(
  src: string | null | undefined,
  profileUrl?: string | null
): Promise<string | null> {
  const buffer = await thinkwayImageBufferForPptx(src, profileUrl);
  if (!buffer?.length) return null;
  const head = buffer.slice(0, 5).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) return null;
  const contentType = detectImageContentType(buffer);
  if (contentType.includes("svg")) return null;
  return `${contentType};base64,${buffer.toString("base64")}`;
}

function addPublicationThumbFrame(
  slide: ThinkwaySlide,
  x: number,
  y: number,
  size: number
): void {
  slide.addShape("roundRect", {
    x,
    y,
    w: size,
    h: size,
    fill: { color: "F2F5FC" },
    line: { color: TW_HAIR, width: 1 },
    rectRadius: 0.1,
  });
}

function addPublicationVideoBadge(slide: ThinkwaySlide, x: number, y: number, size: number): void {
  const badgeSize = Math.min(0.28, size * 0.22);
  const badgeX = x + size - badgeSize - 0.08;
  const badgeY = y + size - badgeSize - 0.08;
  slide.addShape("ellipse", {
    x: badgeX,
    y: badgeY,
    w: badgeSize,
    h: badgeSize,
    fill: { color: TW_NAVY, transparency: 15 },
    line: { type: "none" },
  });
  slide.addText("▶", {
    x: badgeX + badgeSize * 0.22,
    y: badgeY + badgeSize * 0.08,
    w: badgeSize * 0.6,
    h: badgeSize * 0.75,
    fontFace: TW_FONT_UI,
    fontSize: 8,
    color: TW_WHITE,
    align: "center",
  });
}

export async function addThinkwayPublicationThumbs(
  slide: ThinkwaySlide,
  shots: ThinkwayPublicationShot[],
  y: number,
  title: string,
  columns = TW_PUB_COLS,
  thumbSize = TW_PUB_THUMB_SIZE
): Promise<number> {
  slide.addText(title.toUpperCase(), {
    x: TW_MARGIN_X,
    y,
    w: TW_CONTENT_W,
    h: 0.18,
    fontFace: TW_FONT_UI,
    fontSize: 9,
    bold: true,
    color: TW_BLUE,
    charSpacing: 1.2,
  });

  const visible = shots.slice(0, columns);
  if (!visible.length) {
    slide.addText("No publication screenshots available.", {
      x: TW_MARGIN_X,
      y: y + 0.22,
      w: TW_CONTENT_W,
      h: 0.26,
      fontFace: TW_FONT_BODY,
      fontSize: 10,
      color: TW_MUTED,
      italic: true,
    });
    return y + 0.52;
  }

  const thumbY = y + 0.2;
  for (let index = 0; index < visible.length; index++) {
    const shot = visible[index]!;
    const x = TW_MARGIN_X + index * (thumbSize + TW_PUB_GAP);
    addPublicationThumbFrame(slide, x, thumbY, thumbSize);

    const imageData = await thinkwayImageDataForPptxOriginal(shot.imageUrl);
    if (imageData) {
      slide.addImage({
        data: imageData,
        x,
        y: thumbY,
        w: thumbSize,
        h: thumbSize,
        sizing: { type: "cover", w: thumbSize, h: thumbSize },
      });
      if (shot.isVideo) {
        addPublicationVideoBadge(slide, x, thumbY, thumbSize);
      }
    }
  }

  return thumbY + thumbSize + TW_GAP_MD;
}

export async function addThinkwayCreatorAvatar(
  slide: ThinkwaySlide,
  input: {
    avatarUrl: string | null;
    initials: string;
    x: number;
    y: number;
    size: number;
    pitch?: boolean;
    /** Click-through to creator profile (Instagram/TikTok/etc.). */
    profileHref?: string | null;
  }
): Promise<void> {
  const { avatarUrl, initials, x, y, size, pitch = true, profileHref } = input;
  const href = profileHref?.trim() && /^https?:\/\//i.test(profileHref.trim())
    ? profileHref.trim()
    : null;
  const hyperlink = href
    ? { url: href, tooltip: "Open creator profile" }
    : undefined;

  // RFQ pitch: frameless circular avatar (no lavender/white ring).

  const avatarData = await thinkwayImageDataForPptxOriginal(avatarUrl, profileHref);
  if (avatarData) {
    slide.addImage({
      data: avatarData,
      x,
      y,
      w: size,
      h: size,
      rounding: true,
      sizing: { type: "cover", w: size, h: size },
      hyperlink,
    });
  } else {
    slide.addShape(pitch ? "ellipse" : "roundRect", {
      x,
      y,
      w: size,
      h: size,
      fill: { color: pitch ? TW_LAVENDER : TW_GREEN },
      line: { type: "none" },
      rectRadius: pitch ? undefined : 0.12,
      hyperlink,
    });
    slide.addText(initials, {
      x,
      y: pitch ? y + size * 0.32 : y + size * 0.14,
      w: size,
      h: pitch ? size * 0.36 : 0.36,
      fontFace: TW_FONT_UI,
      fontSize: pitch ? Math.round(size * 15) : 15,
      bold: true,
      color: pitch ? TW_BLUE : TW_WHITE,
      align: "center",
      hyperlink,
    });
  }

  // Transparent hit-target on top — rounded images sometimes drop image hyperlinks in PPT.
  if (hyperlink) {
    slide.addShape("ellipse", {
      x,
      y,
      w: size,
      h: size,
      fill: { color: TW_WHITE, transparency: 100 },
      line: { type: "none" },
      hyperlink,
    });
  }
}

export function configureThinkwayPptxLayout(pptx: ThinkwayPptxGen): void {
  pptx.defineLayout({ name: "WIDESCREEN_16x9", width: TW_PAGE_W, height: TW_PAGE_H });
  pptx.layout = "WIDESCREEN_16x9";
  pptx.author = "Thinkway Platform";
  pptx.company = "Thinkway";
}
