import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildCollapsePackageMixFeed } from "@/features/quotations/export/quotation-export-mix-feed";
import type {
  QuotationDocCollapsePackageCreator,
  QuotationDocPublicationShot,
  QuotationDocument,
} from "@/features/quotations/export/quotation-document";
import { isCreatorDeckTemplate, isLumpSumPricingTemplate, isPitchTemplate, isShowcaseTemplate } from "@/features/quotations/export/quotation-template";
import { showcaseInitialsFromHandle } from "@/features/quotations/templates/quotation-template-format";
import { buildQuotationTemplatePayload } from "@/features/quotations/templates/quotation-template-payload";
import { cropExportImageBufferCover } from "@/lib/io/compress-export-image";
import {
  addThinkwayCreatorAvatar,
  configureThinkwayPptxLayout,
} from "@/lib/export/thinkway-deck-pptx";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import {
  detectImageContentType,
  fetchImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";

/**
 * Design tokens — matched to reference deck Thinkway_QT-2026-0013.pptx.
 * Cover uses bright blue gradient image; content uses soft lav bokeh; closing uses navy glow.
 */
const BLUE = "0057FF";
const NAVY = "0B0F1A";
const TITLE_INK = "0D1220";
const MUTED = "6B7280";
const MUTED_SOFT = "8A93A6";
const FOOTER_MUTED = "9AA3B5";
const COVER_FOOTER = "8FA3D0";
const COVER_KICKER = "C9DBFF";
const COVER_META = "9FB6E8";
const COVER_STAT_LABEL = "BFD2FF";
const FIELD_MUTED = "AEB6C6";
const HAIR = "E7ECF5";
const ROW_HAIR = "EDF1F7";
const INSIGHT_BG = "F3F7FF";
const SOFT_BLUE = "EAF1FF";
const LINE_SOFT = "D5DCEA";
const WHITE = "FFFFFF";
const LAVENDER = "E8EFFE";
const LAV_LINE = "D5E2FB";
const TW_GREEN = "1D9E75";

/** OOXML alpha 13000 / 18000 / 12000 → pptxgenjs transparency (100 − opacity%). */
const GLASS_CARD_TRANSPARENCY = 87;
const COVER_CHIP_TRANSPARENCY = 82;
const COVER_STAT_TRANSPARENCY = 88;

const FONT_UI = "Arial";
const FONT_BODY = "Calibri";

const PPTX_ASSET_DIR = join(process.cwd(), "features/quotations/export/assets");
const pptxBgCache = new Map<string, string>();

/** Widescreen 16:9 — matches reference sldSz (13.333" × 7.5"). */
const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN_X = 0.6;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const FOOTER_Y = 7.0;
const CONTENT_BOTTOM = 6.85;
const GAP_SM = 0.1;
const GAP_MD = 0.14;
const PUB_GAP = 0.1;
const PUB_COLS = 4;
const PUB_THUMB_SIZE = 1.22;
const SHOWCASE_PUB_LIMIT = 4;
const MIX_FEED_COLS = 6;
const MIX_FEED_THUMB_SIZE = 0.74;
const CREATOR_DELIVERABLES_PER_SLIDE = 7;
const PITCH_DELIVERABLES_PER_SLIDE = 5;
/** Match RFQ_5 creator hero avatar (frameless circle). */
const PITCH_AVATAR_SIZE = 1.67;
/** Match RFQ_5 publication thumbs (rounded image, no white card). */
const PITCH_PUB_THUMB_SIZE = 1.62;
const PITCH_PUB_GAP = 0.22;
const PITCH_PUB_COLS = 3;
/** Closing slide — deep teal, distinct from bright-blue cover. */
const CLOSING_BG = "0A2E24";
const CLOSING_ACCENT = "1D9E75";
const CLOSING_MUTED = "9BC4B4";
/** Matches reference deck pagination (11 fee rows before totals spill). */
const COMMERCIAL_ROWS_PER_SLIDE = 11;
const FOOTER_LEFT = "Thinkway · hello@thinkwaymedia.com";

function platformIconsLabel(platforms: string[]): string {
  if (!platforms.length) return "—";
  return platforms.map((platform) => getReportPlatformIconTitle(platform)).join(", ");
}

function profileHyperlink(
  url: string | null | undefined,
  tooltip = "Open creator profile"
): { url: string; tooltip: string } | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    if (/^\/\//.test(href)) href = `https:${href}`;
    else if (/^[\w.-]+\.[a-z]{2,}([/?#]|$)/i.test(href)) href = `https://${href}`;
    else return undefined;
  }
  return { url: href, tooltip };
}

/** Prefer explicit profile URL, then any platform metric URL. */
function resolveCreatorProfileHref(
  primary: string | null | undefined,
  fallbacks: Array<string | null | undefined> = []
): ReturnType<typeof profileHyperlink> {
  for (const candidate of [primary, ...fallbacks]) {
    const link = profileHyperlink(candidate);
    if (link) return link;
  }
  return undefined;
}

function addPlatformIconBadges(
  slide: Slide,
  platforms: string[],
  x: number,
  y: number,
  maxIcons = 4,
  profileHref?: string | null,
  iconSize = 0.18
): number {
  const unique = [...new Set(platforms.map((p) => p.trim()).filter(Boolean))].slice(0, maxIcons);
  const size = iconSize;
  const gap = 0.04;
  const hyperlink = profileHyperlink(profileHref);
  unique.forEach((platform, index) => {
    const iconX = x + index * (size + gap);
    const dataUri = getReportPlatformIconDataUri(platform);
    if (dataUri?.startsWith("data:")) {
      const payload = dataUri.slice("data:".length);
      const marker = ";base64,";
      const markerIndex = payload.indexOf(marker);
      if (markerIndex >= 0) {
        slide.addImage({
          data: `${payload.slice(0, markerIndex)};base64,${payload.slice(markerIndex + marker.length)}`,
          x: iconX,
          y,
          w: size,
          h: size,
          hyperlink,
        });
        return;
      }
    }
    slide.addShape("ellipse", {
      x: iconX,
      y,
      w: size,
      h: size,
      fill: { color: SOFT_BLUE },
      line: { type: "none" },
    });
    slide.addText(getReportPlatformIconTitle(platform).slice(0, 2).toUpperCase(), {
      x: iconX,
      y,
      w: size,
      h: size,
      fontFace: FONT_UI,
      fontSize: 6,
      bold: true,
      color: BLUE,
      align: "center",
      valign: "middle",
      hyperlink,
    });
  });
  return unique.length * (size + gap);
}

type PptxGen = InstanceType<typeof import("pptxgenjs").default>;
type Slide = ReturnType<PptxGen["addSlide"]>;

type SlideCounter = { n: number };

function pptxBackgroundData(fileName: string): string {
  const cached = pptxBgCache.get(fileName);
  if (cached) return cached;
  const data = readFileSync(join(PPTX_ASSET_DIR, fileName)).toString("base64");
  pptxBgCache.set(fileName, data);
  return data;
}

function applyCoverBackground(slide: Slide): void {
  slide.background = { data: pptxBackgroundData("pptx-cover-bg.png") };
}

function applyContentBackground(slide: Slide): void {
  slide.background = { data: pptxBackgroundData("pptx-content-bg.png") };
}

function applyClosingBackground(slide: Slide): void {
  slide.background = { data: pptxBackgroundData("pptx-closing-bg.png") };
}

function nextSlideNo(counter: SlideCounter): string {
  counter.n += 1;
  return String(counter.n).padStart(2, "0");
}

function optionCountPhrase(count: number): string {
  const words = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
  ];
  if (count >= 1 && count <= 10) {
    return `${words[count]} package option${count === 1 ? "" : "s"}`;
  }
  return `${count} package options`;
}

/** "Mega creators" → "Mega-creator" for collab intro copy. */
function sharedBundlePhrase(label: string): string {
  const trimmed = label.trim();
  const match = trimmed.match(/^(.+?)\s+creators?$/i);
  if (match?.[1]) return `${match[1]}-creator`;
  return trimmed;
}

function creatorTableFontSize(rowCount: number): number {
  if (rowCount <= 4) return 9;
  if (rowCount <= 6) return 8.5;
  return 8;
}

function creatorTableRowHeight(rowCount: number): number {
  if (rowCount <= 4) return 0.26;
  if (rowCount <= 6) return 0.23;
  return 0.21;
}

function addLogoMark(
  slide: Slide,
  x: number,
  y: number,
  size: number,
  variant: "light" | "dark" = "dark"
): void {
  const markFill = variant === "light" ? WHITE : NAVY;
  const dotA = variant === "light" ? NAVY : WHITE;
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
    fill: { color: BLUE },
    line: { type: "none" },
  });
}

function addWordmark(
  slide: Slide,
  x: number,
  y: number,
  variant: "light" | "dark" = "dark",
  fontSize = 14
): void {
  const thinkColor = variant === "light" ? WHITE : NAVY;
  slide.addText(
    [
      { text: "THINK", options: { color: thinkColor, bold: true, fontSize } },
      { text: "WAY", options: { color: BLUE, bold: true, fontSize } },
    ],
    {
      x,
      y,
      w: 1.7,
      h: 0.4,
      fontFace: FONT_UI,
    }
  );
}

function addBrandLockup(
  slide: Slide,
  variant: "light" | "dark" = "dark",
  markY = 0.42,
  wordY = 0.37
): void {
  addLogoMark(slide, MARGIN_X, markY, 0.3, variant);
  addWordmark(slide, 0.98, wordY, variant, 14);
}

/**
 * Content chrome: dark THINK+WAY lockup + tracked section label + title.
 * Returns Y just below the title for content packing.
 */
function addSectionHeader(
  slide: Slide,
  sectionLabel: string,
  title: string
): number {
  addBrandLockup(slide, "dark", 0.42, 0.37);
  slide.addText(sectionLabel, {
    x: MARGIN_X,
    y: 1.02,
    w: 11,
    h: 0.24,
    fontFace: FONT_UI,
    fontSize: 10.5,
    bold: true,
    color: BLUE,
    charSpacing: 1.8,
  });
  slide.addText(title, {
    x: 0.58,
    y: 1.28,
    w: 11.5,
    h: 0.6,
    fontFace: FONT_UI,
    fontSize: 24,
    bold: true,
    color: TITLE_INK,
  });
  return 1.9;
}

function addSlideFooter(
  slide: Slide,
  right: string,
  pageNo: string,
  opts?: { left?: string; color?: string; y?: number }
): void {
  const y = opts?.y ?? FOOTER_Y;
  const color = opts?.color ?? FOOTER_MUTED;
  const left = opts?.left ?? FOOTER_LEFT;
  slide.addText(left, {
    x: MARGIN_X,
    y,
    w: 7,
    h: 0.3,
    fontFace: FONT_UI,
    fontSize: 9,
    color,
  });
  slide.addText(right, {
    x: 8,
    y,
    w: 4.2,
    h: 0.3,
    fontFace: FONT_UI,
    fontSize: 9,
    color,
    align: "right",
  });
  slide.addText(pageNo, {
    x: 12.35,
    y,
    w: 0.4,
    h: 0.3,
    fontFace: FONT_UI,
    fontSize: 9,
    color,
    align: "right",
  });
}

async function imageBufferForPptx(src: string | null | undefined): Promise<Buffer | null> {
  const trimmed = src?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) {
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

  return fetchImageBuffer(trimmed);
}

/**
 * PptxGenJS `sizing: cover` uses the placement box as image dimensions in Node, so portrait
 * publication shots get stretched. Pre-crop to the target aspect before embedding instead.
 */
async function imageDataForPptxCoverCrop(
  src: string | null | undefined,
  aspectW: number,
  aspectH: number,
  maxEdge = 720
): Promise<string | null> {
  const buffer = await imageBufferForPptx(src);
  if (!buffer?.length) return null;

  const cropped = await cropExportImageBufferCover(buffer, {
    aspectW,
    aspectH,
    maxEdge,
  });
  const finalBuffer = cropped?.buffer ?? buffer;
  const contentType = cropped?.contentType ?? detectImageContentType(finalBuffer);
  return `${contentType};base64,${finalBuffer.toString("base64")}`;
}

function addPublicationThumbFrame(
  slide: Slide,
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
    line: { color: HAIR, width: 1 },
    rectRadius: 0.1,
  });
}

function addPublicationVideoBadge(slide: Slide, x: number, y: number, size: number): void {
  const badgeSize = Math.min(0.28, size * 0.22);
  const badgeX = x + size - badgeSize - 0.08;
  const badgeY = y + size - badgeSize - 0.08;
  slide.addShape("ellipse", {
    x: badgeX,
    y: badgeY,
    w: badgeSize,
    h: badgeSize,
    fill: { color: NAVY, transparency: 15 },
    line: { type: "none" },
  });
  slide.addText("▶", {
    x: badgeX + badgeSize * 0.22,
    y: badgeY + badgeSize * 0.08,
    w: badgeSize * 0.6,
    h: badgeSize * 0.75,
    fontFace: FONT_UI,
    fontSize: 8,
    color: WHITE,
    align: "center",
  });
}

function addCoverSlide(pptx: PptxGen, doc: QuotationDocument, counter: SlideCounter): void {
  const payload = buildQuotationTemplatePayload(doc);
  const slide = pptx.addSlide();
  applyCoverBackground(slide);

  addBrandLockup(slide, "light", 0.5, 0.45);

  const chipLabel = `${payload.quotation.version} · ${payload.quotation.status}`.toUpperCase();
  const chipW = Math.min(2.2, 1.0 + chipLabel.length * 0.09);
  slide.addShape("roundRect", {
    x: PAGE_W - MARGIN_X - chipW,
    y: 0.52,
    w: chipW,
    h: 0.34,
    fill: { color: WHITE, transparency: COVER_CHIP_TRANSPARENCY },
    line: { color: WHITE, width: 1 },
    rectRadius: 0.17,
  });
  slide.addText(chipLabel, {
    x: PAGE_W - MARGIN_X - chipW,
    y: 0.58,
    w: chipW,
    h: 0.22,
    fontFace: FONT_UI,
    fontSize: 9,
    bold: true,
    color: COVER_KICKER,
    align: "center",
    charSpacing: 1.2,
  });

  slide.addText(payload.cover.kicker.toUpperCase(), {
    x: MARGIN_X,
    y: 1.85,
    w: 11,
    h: 0.3,
    fontFace: FONT_UI,
    fontSize: 11,
    bold: true,
    color: COVER_KICKER,
    charSpacing: 2.2,
  });

  slide.addText(payload.quotation.title, {
    x: 0.57,
    y: 2.2,
    w: 11.4,
    h: 1.5,
    fontFace: FONT_UI,
    fontSize: 36,
    bold: true,
    color: WHITE,
    valign: "top",
  });

  slide.addText(payload.cover.subtitle, {
    x: MARGIN_X,
    y: 3.72,
    w: 9,
    h: 0.4,
    fontFace: FONT_UI,
    fontSize: 13,
    color: COVER_KICKER,
  });

  const metaCells = [
    ...(isPitchTemplate(doc.template)
      ? []
      : [["Quotation No.", payload.quotation.number] as [string, string]]),
    ["Client", payload.quotation.client],
    ["Brand", payload.quotation.brand],
    ...(isPitchTemplate(doc.template)
      ? []
      : [["Prepared By", payload.quotation.preparedBy] as [string, string]]),
    ["Issue Date", payload.quotation.issueDate],
    ["Valid Until", payload.quotation.validUntil],
    ["Version", payload.quotation.version],
    ["Status", payload.quotation.status],
  ];
  const metaCellW = 2.85;
  const metaGap = 0.18;
  metaCells.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = MARGIN_X + col * (metaCellW + metaGap);
    const y = 4.35 + row * 0.72;
    slide.addText(String(label).toUpperCase(), {
      x,
      y,
      w: metaCellW,
      h: 0.22,
      fontFace: FONT_UI,
      fontSize: 9,
      color: COVER_META,
      charSpacing: 1.2,
    });
    slide.addText(String(value), {
      x,
      y: y + 0.2,
      w: metaCellW,
      h: 0.3,
      fontFace: FONT_UI,
      fontSize: 13,
      bold: true,
      color: WHITE,
    });
  });

  const statW = 5.9;
  const statH = 1.12;
  const statY = 5.78;
  const stats = [
    {
      label: "Campaign Creators",
      value: payload.campaign.creatorCount,
      sub: payload.campaign.tierSummary,
    },
    {
      label: payload.cover.stat3.label,
      // Full total cost as the hero figure (not abbreviated …K).
      value: payload.cover.stat3.value,
      sub: payload.cover.stat3.valueShort,
    },
  ];
  stats.forEach((stat, index) => {
    const x = MARGIN_X + index * (statW + 0.33);
    slide.addShape("roundRect", {
      x,
      y: statY,
      w: statW,
      h: statH,
      fill: { color: WHITE, transparency: COVER_STAT_TRANSPARENCY },
      line: { color: WHITE, width: 1 },
      rectRadius: 0.12,
    });
    slide.addText(stat.label.toUpperCase(), {
      x: x + 0.28,
      y: statY + 0.15,
      w: statW - 0.5,
      h: 0.22,
      fontFace: FONT_UI,
      fontSize: 10,
      color: COVER_STAT_LABEL,
      charSpacing: 1.2,
    });
    slide.addText(stat.value, {
      x: x + 0.26,
      y: statY + 0.36,
      w: statW - 0.5,
      h: 0.5,
      fontFace: FONT_UI,
      fontSize: 28,
      bold: true,
      color: WHITE,
    });
    slide.addText(stat.sub, {
      x: x + 0.28,
      y: statY + 0.82,
      w: statW - 0.5,
      h: 0.24,
      fontFace: FONT_UI,
      fontSize: 11,
      color: COVER_KICKER,
    });
  });

  nextSlideNo(counter);
  slide.addText(payload.footer.left, {
    x: MARGIN_X,
    y: 7.05,
    w: 7,
    h: 0.3,
    fontFace: FONT_UI,
    fontSize: 9,
    color: COVER_FOOTER,
  });
  slide.addText(`Issued ${payload.quotation.issueDate}`, {
    x: 8,
    y: 7.05,
    w: 4.73,
    h: 0.3,
    fontFace: FONT_UI,
    fontSize: 9,
    color: COVER_FOOTER,
    align: "right",
  });
}

function addCreatorMixSlides(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  const payload = buildQuotationTemplatePayload(doc);
  const tiersPerSlide = 2;
  const tierChunks: (typeof payload.tiers)[] = [];
  for (let index = 0; index < payload.tiers.length; index += tiersPerSlide) {
    tierChunks.push(payload.tiers.slice(index, index + tiersPerSlide));
  }
  if (!tierChunks.length) tierChunks.push([]);

  tierChunks.forEach((tierChunk, chunkIndex) => {
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const continued = chunkIndex > 0;
    const isLast = chunkIndex === tierChunks.length - 1;
    const pageNo = nextSlideNo(counter);

    let cursorY = addSectionHeader(
      slide,
      "SECTION 01 · CREATOR MIX",
      continued ? "Creator mix (continued)" : "Creator mix"
    );

    if (!continued) {
      const maxCats = isPitchTemplate(doc.template) ? 6 : 4;
      const categoryCards = payload.categories.slice(0, maxCats);
      const gap = 0.14;
      const catW =
        categoryCards.length > 0
          ? (CONTENT_W - gap * (categoryCards.length - 1)) / categoryCards.length
          : 2.92;
      categoryCards.forEach((cat, index) => {
        const x = MARGIN_X + index * (catW + gap);
        slide.addShape("roundRect", {
          x,
          y: 2.0,
          w: catW,
          h: 1.0,
          fill: { color: WHITE, transparency: GLASS_CARD_TRANSPARENCY },
          line: { color: HAIR, width: 1 },
          rectRadius: 0.1,
        });
        slide.addText(cat.name.toUpperCase(), {
          x: x + 0.12,
          y: 2.14,
          w: catW - 0.24,
          h: 0.2,
          fontFace: FONT_UI,
          fontSize: categoryCards.length > 4 ? 8 : 10,
          bold: true,
          color: MUTED_SOFT,
          charSpacing: 1,
        });
        slide.addText(cat.count, {
          x: x + 0.12,
          y: 2.34,
          w: catW - 0.24,
          h: 0.42,
          fontFace: FONT_UI,
          fontSize: categoryCards.length > 4 ? 22 : 28,
          bold: true,
          color: BLUE,
        });
        slide.addText(`${cat.countLabel} · ${cat.share}`, {
          x: x + 0.12,
          y: 2.78,
          w: catW - 0.24,
          h: 0.2,
          fontFace: FONT_BODY,
          fontSize: categoryCards.length > 4 ? 9 : 11,
          color: MUTED,
        });
      });
      cursorY = 3.3;
      slide.addText("FULL INFLUENCER BREAKDOWN BY TIER", {
        x: MARGIN_X,
        y: cursorY,
        w: 11,
        h: 0.24,
        fontFace: FONT_UI,
        fontSize: 10,
        bold: true,
        color: MUTED_SOFT,
        charSpacing: 1.2,
      });
      cursorY = 3.62;
    } else {
      cursorY = 2.1;
    }

    for (const tier of tierChunk) {
      const creators = tier.creators.slice(0, 8);
      const rowH = 0.24;
      const tableH = 0.26 + creators.length * rowH;

      const tagW = Math.min(1.15, 0.55 + tier.name.length * 0.07);
      slide.addShape("roundRect", {
        x: MARGIN_X,
        y: cursorY,
        w: tagW,
        h: 0.26,
        fill: { color: NAVY },
        line: { type: "none" },
        rectRadius: 0.05,
      });
      slide.addText(tier.name.toUpperCase(), {
        x: MARGIN_X,
        y: cursorY,
        w: tagW,
        h: 0.26,
        fontFace: FONT_UI,
        fontSize: 9,
        bold: true,
        color: WHITE,
        align: "center",
        valign: "middle",
      });
      slide.addText(
        `${tier.profileCount} · ${tier.followers} followers · Avg ER ${tier.avgER}`,
        {
          x: 1.9,
          y: cursorY,
          w: 10.4,
          h: 0.26,
          fontFace: FONT_BODY,
          fontSize: 11,
          color: MUTED,
          valign: "middle",
        }
      );

      const pitchMix = isPitchTemplate(doc.template);
      const colW = pitchMix
        ? [2.2, 1.7, 1.5, 1.4, 3.6, 1.73]
        : [2.6, 2.0, 1.8, 3.9, 1.83];
      const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
        pitchMix
          ? [
              { text: "Handle", options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } } },
              { text: "Platforms", options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } } },
              {
                text: "Followers",
                options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE }, align: "right" },
              },
              {
                text: "Views",
                options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE }, align: "right" },
              },
              { text: "Category", options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } } },
              {
                text: "ER %",
                options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE }, align: "right" },
              },
            ]
          : [
              { text: "Handle", options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } } },
              { text: "Platform", options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } } },
              {
                text: "Followers",
                options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE }, align: "right" },
              },
              { text: "Category", options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } } },
              {
                text: "ER %",
                options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE }, align: "right" },
              },
            ],
        ...creators.map((creator) => {
          const handleLink = profileHyperlink(creator.profileUrl);
          if (pitchMix) {
            return [
              {
                text: creator.handle,
                options: {
                  fontSize: 10,
                  bold: true,
                  color: TITLE_INK,
                  ...(handleLink ? { hyperlink: handleLink } : {}),
                },
              },
              {
                text: creator.platformIcons.length
                  ? `     ${platformIconsLabel(creator.platformIcons)}`
                  : creator.platform,
                options: { fontSize: 10, color: TITLE_INK },
              },
              {
                text: creator.followers,
                options: { fontSize: 10, color: TITLE_INK, align: "right" },
              },
              {
                text: creator.views,
                options: { fontSize: 10, color: TITLE_INK, align: "right" },
              },
              { text: creator.category, options: { fontSize: 9, color: TITLE_INK } },
              {
                text: creator.er,
                options: { fontSize: 10, color: TITLE_INK, align: "right" },
              },
            ];
          }
          return [
            { text: creator.handle, options: { fontSize: 10, bold: true, color: TITLE_INK } },
            { text: creator.platform, options: { fontSize: 10, color: TITLE_INK } },
            {
              text: creator.followers,
              options: { fontSize: 10, color: TITLE_INK, align: "right" },
            },
            { text: creator.category, options: { fontSize: 10, color: TITLE_INK } },
            {
              text: creator.er,
              options: { fontSize: 10, color: TITLE_INK, align: "right" },
            },
          ];
        }),
      ];

      const tableY = cursorY + 0.34;
      slide.addTable(rows, {
        x: MARGIN_X,
        y: tableY,
        w: 12.13,
        colW,
        border: { type: "solid", pt: 0.5, color: ROW_HAIR },
        fontFace: FONT_BODY,
        autoPage: false,
        rowH,
        h: tableH,
        align: "left",
        valign: "middle",
      });

      if (pitchMix) {
        const platformsColX = MARGIN_X + colW[0]! + 0.08;
        creators.forEach((creator, index) => {
          if (!creator.platformIcons.length) return;
          addPlatformIconBadges(
            slide,
            creator.platformIcons,
            platformsColX,
            tableY + 0.26 + index * rowH + 0.03,
            4,
            creator.profileUrl
          );
        });
      }

      cursorY += 0.34 + tableH + 0.28;
    }

    if (isLast) {
      const footerBlockY = Math.min(cursorY + 0.05, CONTENT_BOTTOM - 1.5);
      slide.addShape("roundRect", {
        x: MARGIN_X,
        y: footerBlockY,
        w: 12.13,
        h: 0.62,
        fill: { color: WHITE },
        line: { color: HAIR, width: 1 },
        rectRadius: 0.1,
      });
      slide.addText(`Grand total · ${payload.totals.creatorCount} influencers`, {
        x: 0.85,
        y: footerBlockY,
        w: 5,
        h: 0.62,
        fontFace: FONT_UI,
        fontSize: 13,
        bold: true,
        color: TITLE_INK,
        valign: "middle",
      });
      slide.addText(`FOLLOWERS\n${payload.totals.followers}`, {
        x: 7.2,
        y: footerBlockY,
        w: 2.5,
        h: 0.62,
        fontFace: FONT_BODY,
        fontSize: 11,
        color: MUTED_SOFT,
        align: "right",
        valign: "middle",
      });
      slide.addText(`AVG ER\n${payload.totals.avgER}`, {
        x: 9.9,
        y: footerBlockY,
        w: 2.6,
        h: 0.62,
        fontFace: FONT_BODY,
        fontSize: 11,
        color: MUTED_SOFT,
        align: "right",
        valign: "middle",
      });

      const insightParts = [
        payload.insight.categoryMix,
        payload.insight.tierMix,
        payload.insight.scale,
      ]
        .filter(Boolean)
        .join("  ");
      if (insightParts && footerBlockY + 0.72 < CONTENT_BOTTOM) {
        const insightY = footerBlockY + 0.78;
        slide.addShape("roundRect", {
          x: MARGIN_X,
          y: insightY,
          w: 12.13,
          h: 0.72,
          fill: { color: INSIGHT_BG },
          line: { type: "none" },
          rectRadius: 0.1,
        });
        slide.addShape("roundRect", {
          x: 0.82,
          y: insightY + 0.18,
          w: 0.34,
          h: 0.34,
          fill: { color: SOFT_BLUE },
          line: { type: "none" },
          rectRadius: 0.08,
        });
        slide.addText("✦", {
          x: 0.82,
          y: insightY + 0.18,
          w: 0.34,
          h: 0.34,
          fontFace: FONT_UI,
          fontSize: 11,
          color: BLUE,
          align: "center",
          valign: "middle",
        });
        slide.addText(`Campaign mix insight.   ${insightParts}`, {
          x: 1.35,
          y: insightY,
          w: 11.1,
          h: 0.72,
          fontFace: FONT_BODY,
          fontSize: 11,
          color: TITLE_INK,
          valign: "middle",
        });
      }
    }

    addSlideFooter(
      slide,
      `${doc.serial} · Creator mix${continued ? ` · ${chunkIndex + 1}` : ""}`,
      pageNo
    );
  });
}

async function addPublicationThumbs(
  slide: Slide,
  shots: QuotationDocPublicationShot[],
  y: number,
  title: string,
  columns = PUB_COLS,
  thumbSize = PUB_THUMB_SIZE,
  options?: {
    centered?: boolean;
    gap?: number;
    /** White padded card (legacy). Prefer `frameless` for RFQ pitch. */
    cardStyle?: boolean;
    /** Image-only rounded thumbs — no behind card / fill frame (RFQ_5). */
    frameless?: boolean;
  }
): Promise<number> {
  slide.addText(title.toUpperCase(), {
    x: MARGIN_X,
    y,
    w: CONTENT_W,
    h: 0.18,
    fontFace: FONT_UI,
    fontSize: 9,
    bold: true,
    color: BLUE,
    charSpacing: 1.2,
    align: options?.centered ? "center" : "left",
  });

  const visible = shots.slice(0, columns);
  if (!visible.length) {
    slide.addText("No publication screenshots available.", {
      x: MARGIN_X,
      y: y + 0.22,
      w: CONTENT_W,
      h: 0.26,
      fontFace: FONT_BODY,
      fontSize: 10,
      color: MUTED,
      italic: true,
      align: options?.centered ? "center" : "left",
    });
    return y + 0.52;
  }

  const gap = options?.gap ?? PUB_GAP;
  const pad = options?.cardStyle && !options?.frameless ? 0.08 : 0;
  const cardSize = thumbSize + pad * 2;
  const rowW = visible.length * cardSize + (visible.length - 1) * gap;
  const startX = options?.centered
    ? MARGIN_X + Math.max(0, (CONTENT_W - rowW) / 2)
    : MARGIN_X;
  const thumbY = y + 0.22;
  const rounded = Boolean(options?.cardStyle || options?.frameless);

  for (let index = 0; index < visible.length; index++) {
    const shot = visible[index]!;
    const cardX = startX + index * (cardSize + gap);
    const x = cardX + pad;
    const imgY = thumbY + pad;

    if (!options?.frameless) {
      if (options?.cardStyle) {
        slide.addShape("roundRect", {
          x: cardX,
          y: thumbY,
          w: cardSize,
          h: cardSize,
          fill: { color: WHITE },
          line: { color: LAV_LINE, width: 1.25 },
          rectRadius: 0.1,
        });
      } else {
        addPublicationThumbFrame(slide, x, imgY, thumbSize);
      }
    }

    const imageData = await imageDataForPptxCoverCrop(shot.imageUrl, 1, 1, 640);
    if (imageData) {
      slide.addImage({
        data: imageData,
        x,
        y: imgY,
        w: thumbSize,
        h: thumbSize,
        ...(rounded ? { rounding: true } : {}),
        ...(shot.postUrl && /^https?:\/\//i.test(shot.postUrl)
          ? { hyperlink: { url: shot.postUrl } }
          : {}),
      });
      if (shot.isVideo) {
        addPublicationVideoBadge(slide, x, imgY, thumbSize);
      }
    }
  }

  return thumbY + cardSize + GAP_MD;
}

function addCreatorDeliverablesTable(
  slide: Slide,
  deliverables: ReturnType<typeof buildQuotationTemplatePayload>["showcaseCreators"][number]["deliverables"],
  showFees: boolean,
  y: number
): number {
  const header = showFees
    ? ["Option", "Service description", "Platform", "Type", "Influencer price (EGP)"]
    : ["Option", "Service description", "Platform", "Type"];

  const tableFontSize = creatorTableFontSize(deliverables.length);
  const colW = showFees ? [1.1, 4.5, 2.0, 1.9, 2.43] : [1.2, 5.3, 2.4, 2.93];
  const tableRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
    header.map((cell) => ({
      text: cell,
      options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } },
    })),
    ...deliverables.map((row) => {
      const platformText = row.platformIcons.length
        ? `     ${platformIconsLabel(row.platformIcons)}`
        : row.platform;
      const cells = [row.option, row.service, platformText, row.type];
      if (showFees) cells.push(row.grossFee ?? "-");
      return cells.map((cell) => ({
        text: cell,
        options: {
          fontSize: tableFontSize,
          color: TITLE_INK,
          valign: "middle",
        },
      }));
    }),
  ];

  const rowH = creatorTableRowHeight(deliverables.length);
  slide.addTable(tableRows, {
    x: MARGIN_X,
    y,
    w: CONTENT_W,
    colW,
    border: { type: "solid", color: LAVENDER, pt: 1 },
    fontFace: FONT_BODY,
    autoPage: false,
    rowH,
  });

  const platformColX = MARGIN_X + colW[0]! + colW[1]! + 0.08;
  const headerH = 0.26;
  deliverables.forEach((row, index) => {
    if (!row.platformIcons.length) return;
    addPlatformIconBadges(
      slide,
      row.platformIcons,
      platformColX,
      y + headerH + index * rowH + Math.max((rowH - 0.18) / 2, 0.04)
    );
  });

  return y + headerH + deliverables.length * rowH + 0.2;
}

function addPitchCreatorMetricsTable(
  slide: Slide,
  creator: ReturnType<typeof buildQuotationTemplatePayload>["showcaseCreators"][number],
  x: number,
  y: number,
  w: number
): number {
  // RFQ reference: one metrics row per linked platform; Tier and Category stay split columns.
  const metricRows =
    creator.platformMetrics.length > 0
      ? creator.platformMetrics
      : [
          {
            platform: creator.platformIcons[0] ?? "instagram",
            followers: creator.followers,
            engagement: creator.engagement,
            views: creator.views,
            profileUrl: creator.profileUrl ?? null,
            avatarUrl: creator.avatarUrl ?? null,
          },
        ];

  const rowH = 0.28;
  const colW = [w * 0.16, w * 0.15, w * 0.14, w * 0.12, w * 0.23, w * 0.2];
  const bodyRows = metricRows.map((row, index) => [
    {
      text: row.followers,
      options: { fontSize: 10, bold: index === 0, color: TITLE_INK },
    },
    {
      text: row.engagement,
      options: { fontSize: 10, bold: index === 0, color: TITLE_INK },
    },
    { text: row.views, options: { fontSize: 10, color: TITLE_INK } },
    {
      text: index === 0 ? creator.tier : "",
      options: { fontSize: 10, color: TITLE_INK },
    },
    {
      text: index === 0 ? creator.categories : "",
      options: { fontSize: 9, color: TITLE_INK },
    },
    {
      text: `     ${getReportPlatformIconTitle(row.platform)}`,
      options: { fontSize: 9, color: TITLE_INK },
    },
  ]);

  slide.addTable(
    [
      [
        { text: "Followers", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Engagement", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Views", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Tier", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Category", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Platforms", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
      ],
      ...bodyRows,
    ],
    {
      x,
      y,
      w,
      colW,
      border: { type: "solid", color: LAVENDER, pt: 1 },
      fontFace: FONT_BODY,
      autoPage: false,
      rowH,
    }
  );

  const platformsColX = x + colW.slice(0, 5).reduce((sum, value) => sum + value, 0) + 0.06;
  metricRows.forEach((row, index) => {
    addPlatformIconBadges(
      slide,
      [row.platform],
      platformsColX,
      y + rowH * (index + 1) + 0.05,
      1,
      row.profileUrl ?? creator.profileUrl
    );
  });

  return y + rowH * (metricRows.length + 1) + 0.12;
}

async function addCreatorSlide(
  pptx: PptxGen,
  doc: QuotationDocument,
  index: number,
  counter: SlideCounter
): Promise<void> {
  const payload = buildQuotationTemplatePayload(doc);
  const creator = payload.showcaseCreators[index];
  const group = doc.creatorGroups[index];
  if (!creator || !group) return;

  const pitch = isPitchTemplate(doc.template);
  const showFees = payload.flags.showFees;
  const perSlide = pitch ? PITCH_DELIVERABLES_PER_SLIDE : CREATOR_DELIVERABLES_PER_SLIDE;
  const deliverableChunks: (typeof creator.deliverables)[] = [];
  for (let offset = 0; offset < creator.deliverables.length; offset += perSlide) {
    deliverableChunks.push(creator.deliverables.slice(offset, offset + perSlide));
  }
  if (!deliverableChunks.length) deliverableChunks.push([]);

  const pubThumbSize = pitch
    ? PITCH_PUB_THUMB_SIZE
    : creator.deliverables.length > 5
      ? Math.min(PUB_THUMB_SIZE, 1.1)
      : PUB_THUMB_SIZE;
  const profileLink = resolveCreatorProfileHref(creator.profileUrl ?? group.profileUrl, [
    ...creator.platformMetrics.map((row) => row.profileUrl),
    ...group.platformMetrics.map((row) => row.profileUrl),
  ]);

  for (let chunkIndex = 0; chunkIndex < deliverableChunks.length; chunkIndex++) {
    const deliverables = deliverableChunks[chunkIndex]!;
    const continued = chunkIndex > 0;
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const pageNo = nextSlideNo(counter);

    addBrandLockup(slide, "dark", 0.42, 0.37);
    slide.addText(
      `SECTION 01 · CREATOR ${creator.index} OF ${payload.totals.creatorCount}${continued ? " (CONTINUED)" : ""}`,
      {
        x: MARGIN_X,
        y: 1.02,
        w: 11,
        h: 0.24,
        fontFace: FONT_UI,
        fontSize: 10.5,
        bold: true,
        color: BLUE,
        charSpacing: 1.6,
      }
    );

    let contentY = 1.9;
    if (!continued) {
      const avatarSize = pitch ? PITCH_AVATAR_SIZE : 0.64;
      const avatarY = 1.3;

      await addThinkwayCreatorAvatar(slide, {
        avatarUrl: group.avatarUrl,
        initials: creator.initials,
        x: MARGIN_X,
        y: avatarY,
        size: avatarSize,
        pitch,
        profileHref: profileLink?.url ?? creator.profileUrl ?? group.profileUrl,
      });

      const nameX = MARGIN_X + avatarSize + (pitch ? 0.28 : 0.14);
      const identityW = CONTENT_W - avatarSize - (pitch ? 0.28 : 0.14);
      slide.addText(
        [
          {
            text: creator.name,
            options: {
              bold: true,
              color: TITLE_INK,
              fontFace: FONT_UI,
              fontSize: pitch ? 22 : 22,
              ...(profileLink ? { hyperlink: profileLink } : {}),
            },
          },
        ],
        {
          x: nameX,
          y: avatarY,
          w: identityW,
          h: 0.34,
        }
      );
      slide.addText(
        [
          {
            text: creator.handle,
            options: {
              color: MUTED,
              fontFace: FONT_BODY,
              fontSize: pitch ? 11 : 11,
              ...(profileLink ? { hyperlink: profileLink } : {}),
            },
          },
        ],
        {
          x: nameX,
          y: avatarY + 0.34,
          w: identityW * 0.55,
          h: 0.18,
        }
      );

      // Pitch/RFQ: platform icons live in the metrics Platforms column only
      // (plain 0.18" logos — no under-avatar chrome).
      if (!pitch && creator.platformIcons.length) {
        addPlatformIconBadges(
          slide,
          creator.platformIcons,
          nameX + identityW * 0.55,
          avatarY + 0.34,
          6,
          creator.profileUrl ?? group.profileUrl,
          0.18
        );
      }

      if (pitch) {
        contentY = addPitchCreatorMetricsTable(
          slide,
          creator,
          nameX,
          avatarY + 0.58,
          identityW
        );
        contentY = Math.max(contentY, avatarY + avatarSize + GAP_MD);
      } else {
        const metrics = [
          ["Followers", creator.followers],
          ["Engagement", creator.engagement],
          ["Views", creator.views],
          ["Tier", creator.tier],
          ["Categories", creator.categories],
        ];
        const metricW = CONTENT_W / 5 - 0.08;
        const metricY = 2.15;
        metrics.forEach(([label, value], metricIndex) => {
          const x = MARGIN_X + metricIndex * (metricW + GAP_SM);
          slide.addShape("roundRect", {
            x,
            y: metricY,
            w: metricW,
            h: 0.64,
            fill: { color: LAVENDER },
            line: { color: LAV_LINE, width: 1 },
            rectRadius: 0.08,
          });
          slide.addText(label.toUpperCase(), {
            x: x + 0.08,
            y: metricY + 0.08,
            w: metricW - 0.16,
            h: 0.14,
            fontFace: FONT_UI,
            fontSize: 8,
            color: MUTED,
            charSpacing: 0.8,
          });
          slide.addText(value, {
            x: x + 0.08,
            y: metricY + 0.26,
            w: metricW - 0.16,
            h: 0.3,
            fontFace: FONT_BODY,
            fontSize: 11,
            bold: true,
            color: TITLE_INK,
          });
        });
        contentY = metricY + 0.74;
      }

      contentY = await addPublicationThumbs(
        slide,
        group.publicationShots.slice(0, pitch ? PITCH_PUB_COLS : SHOWCASE_PUB_LIMIT),
        contentY,
        "Recent publications",
        pitch ? PITCH_PUB_COLS : PUB_COLS,
        pubThumbSize,
        pitch
          ? { centered: true, gap: PITCH_PUB_GAP, frameless: true }
          : undefined
      );
    } else {
      contentY = 1.55;
    }

    slide.addText(
      (continued ? "Proposed deliverables (continued)" : "Proposed deliverables").toUpperCase(),
      {
        x: MARGIN_X,
        y: contentY,
        w: CONTENT_W,
        h: 0.18,
        fontFace: FONT_UI,
        fontSize: 9,
        bold: true,
        color: BLUE,
        charSpacing: 1.2,
      }
    );

    addCreatorDeliverablesTable(slide, deliverables, showFees, contentY + 0.2);

    addSlideFooter(
      slide,
      `${doc.serial} · ${creator.handle}${continued ? ` · ${chunkIndex + 1}` : ""}`,
      pageNo
    );
  }
}

function collabCreatorDisplayName(creator: QuotationDocCollapsePackageCreator): string {
  const handle = creator.handle.replace(/^@/, "").trim();
  if (handle && handle !== "—") return handle;
  return creator.creator;
}

function addCollabCreatorRow(
  slide: Slide,
  creator: QuotationDocCollapsePackageCreator,
  x: number,
  y: number,
  w: number
): void {
  const initials = showcaseInitialsFromHandle(creator.handle || creator.creator);
  slide.addShape("ellipse", {
    x,
    y,
    w: 0.26,
    h: 0.26,
    fill: { color: SOFT_BLUE },
    line: { type: "none" },
  });
  slide.addText(initials, {
    x,
    y,
    w: 0.26,
    h: 0.26,
    fontFace: FONT_UI,
    fontSize: 8,
    bold: true,
    color: BLUE,
    align: "center",
    valign: "middle",
  });
  slide.addText(
    `${collabCreatorDisplayName(creator)}   ${creator.followers} followers · ${creator.engagementRate} ER`,
    {
      x: x + 0.34,
      y: y - 0.02,
      w: Math.max(w - 0.4, 1),
      h: 0.18,
      fontFace: FONT_BODY,
      fontSize: 10,
      color: TITLE_INK,
    }
  );
  slide.addText(creator.tier.toUpperCase(), {
    x: x + 0.34,
    y: y + 0.14,
    w: Math.max(w - 0.4, 1),
    h: 0.16,
    fontFace: FONT_UI,
    fontSize: 9,
    color: MUTED_SOFT,
    charSpacing: 0.6,
  });
}

function addCollabPackageCard(
  slide: Slide,
  pkg: QuotationDocument["collapseContentGroups"][number]["packages"][number],
  x: number,
  y: number,
  w: number,
  h: number,
  costLabel: string
): void {
  const pad = 0.26;
  const innerW = w - pad * 2;

  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    fill: { color: WHITE, transparency: GLASS_CARD_TRANSPARENCY },
    line: { color: HAIR, width: 1 },
    rectRadius: 0.1,
  });

  slide.addText("COLLAB PACKAGE", {
    x: x + pad,
    y: y + 0.2,
    w: Math.max(innerW - 2.2, 1.2),
    h: 0.2,
    fontFace: FONT_UI,
    fontSize: 9,
    bold: true,
    color: MUTED_SOFT,
    charSpacing: 1.2,
  });
  slide.addText(pkg.optionLabel, {
    x: x + pad - 0.02,
    y: y + 0.4,
    w: Math.max(innerW - 2.2, 1.1),
    h: 0.36,
    fontFace: FONT_UI,
    fontSize: 16,
    bold: true,
    color: TITLE_INK,
  });

  const costX = x + w - pad - 2.05;
  slide.addText(costLabel.toUpperCase(), {
    x: costX,
    y: y + 0.22,
    w: 2.05,
    h: 0.18,
    fontFace: FONT_UI,
    fontSize: 9,
    bold: true,
    color: MUTED_SOFT,
    align: "right",
    charSpacing: 1,
  });
  slide.addText(pkg.clientCost || "—", {
    x: costX,
    y: y + 0.4,
    w: 2.05,
    h: 0.32,
    fontFace: FONT_UI,
    fontSize: 14,
    bold: true,
    color: BLUE,
    align: "right",
  });

  const fields = [
    ["SERVICE", pkg.serviceDescription],
    ["TYPE", pkg.type],
    ["PLATFORMS", pkg.platforms],
    ["DELIVERABLES", pkg.deliverables],
  ] as const;
  let fieldY = y + 0.95;
  for (const [label, value] of fields) {
    slide.addText(label, {
      x: x + pad,
      y: fieldY,
      w: innerW,
      h: 0.16,
      fontFace: FONT_UI,
      fontSize: 8,
      bold: true,
      color: FIELD_MUTED,
      charSpacing: 1,
    });
    slide.addText(value, {
      x: x + pad,
      y: fieldY + 0.15,
      w: innerW,
      h: 0.26,
      fontFace: FONT_BODY,
      fontSize: 11,
      color: TITLE_INK,
    });
    fieldY += 0.47;
  }

  slide.addText("CREATORS IN THIS PACKAGE", {
    x: x + pad,
    y: fieldY + 0.05,
    w: innerW,
    h: 0.16,
    fontFace: FONT_UI,
    fontSize: 8,
    bold: true,
    color: FIELD_MUTED,
    charSpacing: 1,
  });

  const visibleCreators = pkg.creators.slice(0, 4);
  visibleCreators.forEach((creator, index) => {
    addCollabCreatorRow(
      slide,
      creator,
      x + pad,
      fieldY + 0.3 + index * 0.42,
      innerW
    );
  });
}

async function addCollabBundleSlide(
  pptx: PptxGen,
  doc: QuotationDocument,
  bundle: QuotationDocument["collapseContentGroups"][number],
  counter: SlideCounter,
  packageSlideCounter: SlideCounter,
  options?: { showcaseRich?: boolean }
): Promise<void> {
  const packages = bundle.packages;
  if (!packages.length) return;

  // Cap columns per slide; spill extras to continuation slides.
  const maxCols = 3;
  const chunks: (typeof packages)[] = [];
  for (let i = 0; i < packages.length; i += maxCols) {
    chunks.push(packages.slice(i, i + maxCols));
  }

  const costLabel =
    isCreatorDeckTemplate(doc.template) && !isLumpSumPricingTemplate(doc.template)
      ? "Influencer price"
      : "Client cost";

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]!;
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const pageNo = nextSlideNo(counter);
    const packageSlideNo = nextSlideNo(packageSlideCounter);
    const continued = chunkIndex > 0;

    addSectionHeader(
      slide,
      "SECTION 01 · COLLAB PACKAGES",
      continued
        ? `Collab packages · ${bundle.label} (continued)`
        : `Collab packages · ${bundle.label}`
    );

    if (!continued) {
      const intro = `${optionCountPhrase(bundle.optionCount)} with a shared ${sharedBundlePhrase(bundle.label)} bundle and independent pricing per option.`;
      slide.addText(intro, {
        x: MARGIN_X,
        y: 1.95,
        w: 11.5,
        h: 0.3,
        fontFace: FONT_BODY,
        fontSize: 12,
        color: MUTED,
      });
    }

    const cols = chunk.length;
    const cardY = continued ? 2.1 : 2.4;
    const cardH = 4.15;
    const gap = cols === 3 ? 0.25 : 0.33;
    const cardW =
      cols === 1 ? 12.13 : cols === 2 ? 5.9 : (12.13 - gap * (cols - 1)) / cols;

    chunk.forEach((pkg, index) => {
      const x = MARGIN_X + index * (cardW + gap);
      addCollabPackageCard(slide, pkg, x, cardY, cardW, cardH, costLabel);
    });

    // Showcase: optional mix-feed strip under single-option cards when space allows.
    if (options?.showcaseRich && cols === 1 && chunk[0]) {
      const mixFeedShots = buildCollapsePackageMixFeed(doc, chunk[0].creators).slice(
        0,
        MIX_FEED_COLS
      );
      if (mixFeedShots.length) {
        await addPublicationThumbs(
          slide,
          mixFeedShots,
          Math.min(cardY + cardH + 0.08, CONTENT_BOTTOM - MIX_FEED_THUMB_SIZE - 0.4),
          "Mix feed",
          MIX_FEED_COLS,
          MIX_FEED_THUMB_SIZE
        );
      }
    }

    // Reference footers: "Packages", then "Packages · 2", …
    addSlideFooter(
      slide,
      `${doc.serial} · Packages${Number(packageSlideNo) > 1 ? ` · ${Number(packageSlideNo)}` : ""}`,
      pageNo
    );
  }
}

async function addCollabSlides(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter,
  options?: { showcaseRich?: boolean }
): Promise<void> {
  if (!doc.collapseContentGroups.length) return;
  const packageSlideCounter: SlideCounter = { n: 0 };
  for (const bundle of doc.collapseContentGroups) {
    await addCollabBundleSlide(pptx, doc, bundle, counter, packageSlideCounter, options);
  }
}

async function addRosterSlide(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): Promise<void> {
  const payload = buildQuotationTemplatePayload(doc);
  const slide = pptx.addSlide();
  applyContentBackground(slide);
  const pageNo = nextSlideNo(counter);

  const cursorY = addSectionHeader(
    slide,
    `SECTION ${payload.roster.sectionNo} · CREATOR ROSTER`,
    "At a glance"
  );

  // Leave left inset in Creator column for circular avatar overlays (RFQ reference).
  const avatarSize = 0.22;
  const colW = [2.35, 1.25, 1.0, 1.2, 1.05, 2.45, 2.83];
  const rowH = 0.34;
  const tableY = cursorY + 0.1;
  const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
    [
      { text: "Creator", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
      { text: "Followers", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
      { text: "Eng %", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
      { text: "Avg views", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
      { text: "Tier", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
      { text: "Category", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
      { text: "Platforms", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
    ],
    ...payload.roster.rows.map((row) => {
      const handleLink = resolveCreatorProfileHref(row.profileUrl);
      return [
        {
          text: row.handle,
          options: {
            fontSize: 9,
            bold: true,
            color: TITLE_INK,
            // top, right, bottom, left — room for avatar
            margin: [0.04, 0.04, 0.04, 0.34] as [number, number, number, number],
            ...(handleLink ? { hyperlink: handleLink } : {}),
          },
        },
        { text: row.followers, options: { fontSize: 9, color: TITLE_INK } },
        { text: row.er, options: { fontSize: 9, color: TITLE_INK } },
        { text: row.views, options: { fontSize: 9, color: TITLE_INK } },
        { text: row.tier, options: { fontSize: 9, color: TITLE_INK } },
        { text: row.categories, options: { fontSize: 9, color: TITLE_INK } },
        {
          text: row.platformIcons.length
            ? `     ${platformIconsLabel(row.platformIcons)}`
            : row.platforms,
          options: { fontSize: 9, color: TITLE_INK },
        },
      ];
    }),
  ];

  slide.addTable(rows, {
    x: MARGIN_X,
    y: tableY,
    w: CONTENT_W,
    colW,
    border: { type: "solid", color: HAIR, pt: 0.75 },
    fontFace: FONT_BODY,
    autoPage: false,
    rowH,
  });

  const platformColX = MARGIN_X + colW.slice(0, 6).reduce((sum, value) => sum + value, 0) + 0.06;
  for (let index = 0; index < payload.roster.rows.length; index++) {
    const row = payload.roster.rows[index]!;
    const rowTop = tableY + rowH * (index + 1);
    const avatarX = MARGIN_X + 0.08;
    const avatarY = rowTop + (rowH - avatarSize) / 2;

    const rosterLink = resolveCreatorProfileHref(row.profileUrl);
    await addThinkwayCreatorAvatar(slide, {
      avatarUrl: row.avatarUrl ?? null,
      initials: row.initials,
      x: avatarX,
      y: avatarY,
      size: avatarSize,
      pitch: false,
      profileHref: rosterLink?.url ?? row.profileUrl,
    });

    if (row.platformIcons.length) {
      addPlatformIconBadges(
        slide,
        row.platformIcons,
        platformColX,
        rowTop + (rowH - 0.18) / 2,
        5,
        rosterLink?.url ?? row.profileUrl
      );
    }
  }

  // Bottom KPI strip — matches RFQ At a glance footer cards.
  const kpiY = Math.min(
    tableY + rowH * (payload.roster.rows.length + 1) + 0.28,
    CONTENT_BOTTOM - 0.9
  );
  const kpis = [
    ["CREATORS", payload.totals.creatorCount],
    ["TOTAL REACH", payload.totals.followers],
    ["AVG ENGAGEMENT", payload.totals.avgER],
    ["CREATOR TIERS", String(payload.tiers.length)],
  ] as const;
  const kpiW = (CONTENT_W - 0.36) / 4;
  kpis.forEach(([label, value], index) => {
    const x = MARGIN_X + index * (kpiW + 0.12);
    slide.addShape("roundRect", {
      x,
      y: kpiY,
      w: kpiW,
      h: 0.72,
      fill: { color: WHITE },
      line: { color: HAIR, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(label, {
      x: x + 0.14,
      y: kpiY + 0.1,
      w: kpiW - 0.28,
      h: 0.18,
      fontFace: FONT_UI,
      fontSize: 9,
      color: MUTED_SOFT,
      charSpacing: 0.8,
    });
    slide.addText(value, {
      x: x + 0.14,
      y: kpiY + 0.32,
      w: kpiW - 0.28,
      h: 0.28,
      fontFace: FONT_UI,
      fontSize: 18,
      bold: true,
      color: TITLE_INK,
    });
  });

  addSlideFooter(slide, `${doc.serial} · Roster`, pageNo);
}

/** Reference deck commercial copy: "Collab · …" and leader name without option suffix. */
function pptxCommercialFeeLine(
  line: ReturnType<typeof buildQuotationTemplatePayload>["feeLines"][number]
): ReturnType<typeof buildQuotationTemplatePayload>["feeLines"][number] {
  return {
    ...line,
    creator: line.creator.replace(/\s·\sOption\s+\d+$/i, ""),
    deliverable: line.deliverable
      .replace(/^Collap package ·\s*/i, "Collab · ")
      .replace(/^Collap ·\s*/i, "Collab · "),
  };
}

function addCommercialTotalsBlock(
  slide: Slide,
  payload: ReturnType<typeof buildQuotationTemplatePayload>,
  y: number,
  currency = "EGP"
): void {
  const totals = [
    ["Client cost", payload.commercial.subtotalValue, false],
    ["Total agency fee", payload.commercial.agencyFee, false],
    ["Total cost incl. AF", payload.commercial.totalInclAF, true],
  ] as const;
  const gap = 0.14;
  const cardW = (12.13 - gap * 2) / 3;

  totals.forEach(([label, value, isFinal], index) => {
    const x = MARGIN_X + index * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: 0.72,
      fill: { color: isFinal ? NAVY : WHITE },
      line: { color: isFinal ? NAVY : HAIR, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(label.toUpperCase(), {
      x: x + 0.24,
      y: y + 0.12,
      w: cardW - 0.45,
      h: 0.2,
      fontFace: FONT_UI,
      fontSize: 9,
      color: isFinal ? COVER_META : MUTED_SOFT,
      charSpacing: 0.8,
    });
    slide.addText(value, {
      x: x + 0.22,
      y: y + 0.33,
      w: cardW - 0.45,
      h: 0.3,
      fontFace: FONT_UI,
      fontSize: 14,
      bold: true,
      color: isFinal ? WHITE : TITLE_INK,
    });
  });

  slide.addText(`All amounts in ${currency}, inclusive of VAT where applicable.`, {
    x: MARGIN_X,
    y: y + 0.85,
    w: 11,
    h: 0.24,
    fontFace: FONT_BODY,
    fontSize: 10,
    color: MUTED_SOFT,
  });
}

function addCommercialSlides(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  const payload = buildQuotationTemplatePayload(doc);
  const feeChunks: (typeof payload.feeLines)[] = [];
  for (let index = 0; index < payload.feeLines.length; index += COMMERCIAL_ROWS_PER_SLIDE) {
    feeChunks.push(payload.feeLines.slice(index, index + COMMERCIAL_ROWS_PER_SLIDE));
  }
  if (!feeChunks.length) feeChunks.push([]);

  feeChunks.forEach((chunk, chunkIndex) => {
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const isLastChunk = chunkIndex === feeChunks.length - 1;
    const continued = chunkIndex > 0;
    const pageNo = nextSlideNo(counter);

    addSectionHeader(
      slide,
      "SECTION 02 · COMMERCIAL SUMMARY",
      continued ? "Investment & deliverables (continued)" : "Investment & deliverables"
    );

    let cursorY = 2.0;

    if (!payload.flags.itemizedPricing && !continued) {
      slide.addText(`Lump-sum engagement. ${payload.commercial.lumpSumNote}`, {
        x: MARGIN_X,
        y: cursorY,
        w: CONTENT_W,
        h: 0.24,
        fontFace: FONT_BODY,
        fontSize: 10,
        color: MUTED,
      });
      cursorY += 0.32;
    }

    const header = payload.flags.itemizedPricing
      ? ["Creator", "Tier", "Platform", "Deliverable", "Gross fees (EGP)"]
      : ["Creator", "Tier", "Platform", "Deliverable"];

    const tableRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
      header.map((cell, colIndex) => ({
        text: cell,
        options: {
          bold: true,
          color: MUTED,
          fontSize: 9,
          fill: { color: WHITE },
          align: colIndex === header.length - 1 && payload.flags.itemizedPricing ? "right" : "left",
        },
      })),
      ...chunk.map((rawLine) => {
        const line = pptxCommercialFeeLine(rawLine);
        const cells = [line.creator, line.tier, line.platform, line.deliverable];
        if (payload.flags.itemizedPricing) cells.push(line.grossFee ?? "—");
        return cells.map((cell, colIndex) => ({
          text: cell,
          options: {
            fontSize: 10,
            color: TITLE_INK,
            bold: colIndex === 0,
            valign: "middle",
            align:
              colIndex === cells.length - 1 && payload.flags.itemizedPricing ? "right" : "left",
          },
        }));
      }),
    ];

    const rowH = 0.28;
    const tableRowCount = Math.max(chunk.length, 1);
    const tableHeight = 0.32 + tableRowCount * rowH;

    slide.addTable(tableRows, {
      x: MARGIN_X,
      y: cursorY,
      w: 12.13,
      colW: payload.flags.itemizedPricing
        ? [2.6, 1.2, 1.6, 4.4, 2.33]
        : [2.8, 1.3, 1.8, 6.23],
      border: { type: "solid", color: ROW_HAIR, pt: 0.5 },
      fontFace: FONT_BODY,
      autoPage: false,
      rowH,
      h: tableHeight,
      valign: "middle",
    });

    if (isLastChunk) {
      const totalsY = Math.min(cursorY + tableHeight + 0.2, 5.65);
      addCommercialTotalsBlock(slide, payload, totalsY, doc.currency);
    }

    addSlideFooter(
      slide,
      `${doc.serial} · Commercial${continued ? ` · ${chunkIndex + 1}` : ""}`,
      pageNo
    );
  });
}

function addTermsSlide(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  const payload = buildQuotationTemplatePayload(doc);
  const slide = pptx.addSlide();
  applyContentBackground(slide);
  const pageNo = nextSlideNo(counter);

  addSectionHeader(slide, "SECTION 03 · TERMS & CONDITIONS", "The agreement");

  const colW = 5.4;
  const colGap = 0.83;
  const rowH = 1.34;
  const startY = 2.16;

  payload.terms.items.slice(0, 8).forEach((term, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 0.88 + col * (colW + colGap);
    const y = startY + row * rowH;
    slide.addText(term.heading, {
      x,
      y,
      w: colW,
      h: 0.24,
      fontFace: FONT_UI,
      fontSize: 12,
      bold: true,
      color: TITLE_INK,
    });
    slide.addText(term.body, {
      x,
      y: y + 0.28,
      w: colW,
      h: 0.9,
      fontFace: FONT_BODY,
      fontSize: 10,
      color: MUTED,
      valign: "top",
    });
  });

  if (!payload.terms.items.length) {
    slide.addText("No terms configured.", {
      x: MARGIN_X,
      y: 2.16,
      w: CONTENT_W,
      h: 0.3,
      fontFace: FONT_BODY,
      fontSize: 11,
      color: MUTED,
    });
  }

  addSlideFooter(slide, `${doc.serial} · Terms`, pageNo);
}

function addAcceptanceSlide(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  const payload = buildQuotationTemplatePayload(doc);
  const slide = pptx.addSlide();
  applyContentBackground(slide);
  const pageNo = nextSlideNo(counter);

  addSectionHeader(slide, "SECTION 04 · ACCEPTANCE", "Sign & approve");

  slide.addText(
    "By signing below, both parties agree to the scope, pricing, and terms set out in this quotation.",
    {
      x: MARGIN_X,
      y: 1.95,
      w: 11.5,
      h: 0.3,
      fontFace: FONT_BODY,
      fontSize: 12,
      color: MUTED,
    }
  );

  const boxW = 5.9;
  const boxY = 2.5;
  const boxes = [
    {
      title: "Prepared by — Thinkway",
      name: payload.acceptance.preparedByName.toUpperCase(),
    },
    {
      title: "Approved by — Client",
      name: "",
    },
  ];

  boxes.forEach((box, index) => {
    const x = MARGIN_X + index * (boxW + 0.33);
    slide.addShape("roundRect", {
      x,
      y: boxY,
      w: boxW,
      h: 2.25,
      fill: { color: WHITE },
      line: { color: HAIR, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(box.title.toUpperCase(), {
      x: x + 0.3,
      y: boxY + 0.22,
      w: 5.3,
      h: 0.24,
      fontFace: FONT_UI,
      fontSize: 11,
      bold: true,
      color: BLUE,
      charSpacing: 0.8,
    });

    const fields = [
      { label: "NAME", value: box.name, y: 0.7 },
      { label: "SIGNATURE", value: "", y: 1.28 },
      { label: "DATE", value: "", y: 1.82 },
    ];
    fields.forEach((field) => {
      const rowY = boxY + field.y;
      slide.addText(
        field.value ? `${field.label}    ${field.value}` : field.label,
        {
          x: x + 0.3,
          y: rowY,
          w: 5.3,
          h: 0.24,
          fontFace: FONT_UI,
          fontSize: 10,
          color: MUTED_SOFT,
          charSpacing: 0.6,
        }
      );
      slide.addShape("rect", {
        x: x + 0.3,
        y: rowY + 0.32,
        w: 5.3,
        h: 0.01,
        fill: { color: LINE_SOFT },
        line: { type: "none" },
      });
    });
  });

  slide.addShape("roundRect", {
    x: MARGIN_X,
    y: 5.0,
    w: 12.13,
    h: 0.62,
    fill: { color: INSIGHT_BG },
    line: { type: "none" },
    rectRadius: 0.1,
  });
  slide.addText(`Revision history    ${payload.acceptance.revision}`, {
    x: 0.85,
    y: 5.0,
    w: 11.6,
    h: 0.62,
    fontFace: FONT_BODY,
    fontSize: 12,
    color: TITLE_INK,
    valign: "middle",
  });

  addBrandLockup(slide, "dark", 5.9, 5.85);
  slide.addText(payload.company.legalLine, {
    x: MARGIN_X,
    y: 6.32,
    w: 11,
    h: 0.22,
    fontFace: FONT_UI,
    fontSize: 11,
    color: TITLE_INK,
  });
  slide.addText(payload.company.address, {
    x: MARGIN_X,
    y: 6.54,
    w: 11,
    h: 0.22,
    fontFace: FONT_BODY,
    fontSize: 10,
    color: MUTED,
  });

  addSlideFooter(slide, `${doc.serial} · Acceptance`, pageNo);
}

function addClosingSlide(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  const payload = buildQuotationTemplatePayload(doc);
  const slide = pptx.addSlide();
  const pitchClosing = isPitchTemplate(doc.template);
  if (pitchClosing) {
    // Distinct from bright-blue cover: deep teal brand close.
    slide.background = { color: CLOSING_BG };
  } else {
    applyClosingBackground(slide);
  }
  addBrandLockup(slide, "light", 0.55, 0.5);
  nextSlideNo(counter);

  if (pitchClosing) {
    slide.addShape("roundRect", {
      x: MARGIN_X,
      y: 2.15,
      w: 1.35,
      h: 0.1,
      fill: { color: CLOSING_ACCENT },
      line: { type: "none" },
      rectRadius: 0.05,
    });
  }

  slide.addText(
    pitchClosing
      ? "Ready when you are."
      : "Let's build something\nworth watching.",
    {
      x: 0.57,
      y: pitchClosing ? 2.45 : 2.5,
      w: 10.5,
      h: pitchClosing ? 1.1 : 1.7,
      fontFace: FONT_UI,
      fontSize: pitchClosing ? 44 : 40,
      bold: true,
      color: WHITE,
      valign: "top",
    }
  );

  const titleTheme = payload.quotation.title.split(":").slice(1).join(":").trim();
  const themeWord = titleTheme.split(/\s+/)[0]?.toLowerCase();
  const campaignPhrase = themeWord
    ? `${payload.quotation.client} × ${payload.quotation.brand} ${themeWord} campaign`
    : `${payload.quotation.client} × ${payload.quotation.brand} campaign`;
  const thankYou = pitchClosing
    ? `Thank you for reviewing this pitch. We're ready to bring ${campaignPhrase} to life with the right creators.`
    : `Thank you for reviewing this quotation. We're ready to bring the ${campaignPhrase} to life.`;
  slide.addText(thankYou, {
    x: MARGIN_X,
    y: pitchClosing ? 3.85 : 4.25,
    w: 9.5,
    h: 0.6,
    fontFace: FONT_UI,
    fontSize: 13,
    color: pitchClosing ? CLOSING_MUTED : COVER_KICKER,
  });

  slide.addText(
    [
      {
        text: "EMAIL    ",
        options: { color: pitchClosing ? CLOSING_ACCENT : "7F93C4", bold: true },
      },
      {
        text: "hello@thinkwaymedia.com",
        options: { color: pitchClosing ? CLOSING_MUTED : "7F93C4" },
      },
    ],
    {
      x: MARGIN_X,
      y: pitchClosing ? 5.0 : 5.15,
      w: 7,
      h: 0.3,
      fontFace: FONT_UI,
      fontSize: 12,
    }
  );

  slide.addText("Thinkway (ثينكواي) · CR 57920 · VAT 780-879-732", {
    x: MARGIN_X,
    y: 6.9,
    w: 11,
    h: 0.3,
    fontFace: FONT_UI,
    fontSize: 11,
    color: pitchClosing ? CLOSING_MUTED : "7F93C4",
  });
}

async function buildShowcasePptx(pptx: PptxGen, doc: QuotationDocument): Promise<void> {
  const counter: SlideCounter = { n: 0 };
  addCoverSlide(pptx, doc, counter);
  addCreatorMixSlides(pptx, doc, counter);
  await addCollabSlides(pptx, doc, counter, { showcaseRich: true });

  for (let index = 0; index < doc.creatorGroups.length; index++) {
    await addCreatorSlide(pptx, doc, index, counter);
  }

  if (doc.creatorGroups.length > 0) {
    await addRosterSlide(pptx, doc, counter);
  }

  const payload = buildQuotationTemplatePayload(doc);
  if (payload.flags.showCommercialSummary) {
    addCommercialSlides(pptx, doc, counter);
  }

  addClosingSlide(pptx, doc, counter);
}

async function buildDetailedPptx(pptx: PptxGen, doc: QuotationDocument): Promise<void> {
  const payload = buildQuotationTemplatePayload(doc);
  const counter: SlideCounter = { n: 0 };

  addCoverSlide(pptx, doc, counter);
  addCreatorMixSlides(pptx, doc, counter);
  await addCollabSlides(pptx, doc, counter);

  if (payload.flags.showCommercialSummary) {
    addCommercialSlides(pptx, doc, counter);
  }
  if (payload.flags.includeTerms) {
    addTermsSlide(pptx, doc, counter);
  }
  if (payload.flags.includeAcceptance) {
    addAcceptanceSlide(pptx, doc, counter);
  }
  addClosingSlide(pptx, doc, counter);
}

function pptxDeckTitle(doc: QuotationDocument): string {
  if (isPitchTemplate(doc.template)) {
    return `${doc.serial} — ${doc.name} — Pitch Presentation`;
  }
  if (isShowcaseTemplate(doc.template)) {
    return `${doc.serial} — ${doc.name} — Quotation Showcase`;
  }
  if (isLumpSumPricingTemplate(doc.template)) {
    return `${doc.serial} — ${doc.name} — Quotation Lump Sum`;
  }
  return `${doc.serial} — ${doc.name} — Quotation`;
}

export async function buildQuotationPptxBuffer(doc: QuotationDocument): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  configureThinkwayPptxLayout(pptx);
  pptx.title = pptxDeckTitle(doc);

  if (isCreatorDeckTemplate(doc.template)) {
    await buildShowcasePptx(pptx, doc);
  } else {
    await buildDetailedPptx(pptx, doc);
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
