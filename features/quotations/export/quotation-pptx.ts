import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildCollapsePackageMixFeed } from "@/features/quotations/export/quotation-export-mix-feed";
import type {
  QuotationDocCollapsePackageCreator,
  QuotationDocPublicationShot,
  QuotationDocument,
} from "@/features/quotations/export/quotation-document";
import { isCreatorDeckTemplate, isLumpSumPricingTemplate, isPitchTemplate, isShowcaseTemplate } from "@/features/quotations/export/quotation-template";
import {
  formatShowcaseEngagementCardValue,
  showcaseInitialsFromHandle,
} from "@/features/quotations/templates/quotation-template-format";
import { buildQuotationTemplatePayload } from "@/features/quotations/templates/quotation-template-payload";
import { cropExportImageBufferCover } from "@/lib/io/compress-export-image";
import {
  addThinkwayCreatorAvatar,
  configureThinkwayPptxLayout,
} from "@/lib/export/thinkway-deck-pptx";
import {
  chunkPptxWrappedText,
  estimatePptxWrappedTextHeight,
} from "@/lib/export/pptx-text-layout";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import {
  getReportPlatformIconDataUri,
  getReportPlatformIconTitle,
} from "@/lib/performance/report/report-platform-icons";
import {
  detectImageContentType,
  fetchImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";
import { pickCreatorDisplayName } from "@/lib/text/decode-html-entities";

/**
 * Design tokens — Thinkway Quotation decks.
 * Showcase/Lump Sum PPTX must track the QT Redesign HTML preview (cover + investment summary).
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
/** Fewer rows per slide so long service descriptions can wrap without overlap. */
const CREATOR_DELIVERABLES_PER_SLIDE = 5;
const PITCH_DELIVERABLES_PER_SLIDE = 4;
/** Match RFQ_5 creator hero avatar (frameless circle). */
const PITCH_AVATAR_SIZE = 1.67;
/** Match RFQ_5 publication thumbs (rounded image, no white card). */
const PITCH_PUB_THUMB_SIZE = 1.62;
const PITCH_PUB_GAP = 0.22;
const PITCH_PUB_COLS = 3;
/** Closing slide accents — match RFQ_5 slide 14 (navy glow bg + blue accents). */
const CLOSING_ACCENT = "3D8BFF";
const CLOSING_MUTED = "BFD2FF";
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

/** True when a data-URI / pptxgen payload is SVG markup (even if mime says png). */
function isSvgBase64Payload(data: string): boolean {
  if (!data) return false;
  if (data.startsWith("data:image/svg") || data.startsWith("image/svg")) return true;
  const marker = ";base64,";
  const markerIndex = data.indexOf(marker);
  if (markerIndex < 0) return false;
  try {
    const head = Buffer.from(data.slice(markerIndex + marker.length, markerIndex + marker.length + 48), "base64")
      .toString("utf8")
      .trimStart()
      .toLowerCase();
    return head.startsWith("<svg") || head.startsWith("<?xml");
  } catch {
    return false;
  }
}

/**
 * Platform logos — frameless circular icons.
 * `overlap: true` stacks them like shortlist CreatorLinkedPlatformIcons (~40% cross).
 */
function addPlatformIconBadges(
  slide: Slide,
  platforms: string[],
  x: number,
  y: number,
  maxIcons = 4,
  profileHref?: string | null,
  iconSize = 0.18,
  options?: { overlap?: boolean }
): number {
  const unique = [...new Set(platforms.map((p) => p.trim()).filter(Boolean))].slice(0, maxIcons);
  const size = iconSize;
  // Shortlist inline: size-4 + -ml-2 ≈ 50% overlap; use ~40% so logos stay readable in PPT.
  const step = options?.overlap ? size * 0.6 : size + 0.04;
  const hyperlink = profileHyperlink(profileHref);
  unique.forEach((platform, index) => {
    const iconX = x + index * step;
    const dataUri = getReportPlatformIconDataUri(platform);
    // Never embed SVG — pptxgenjs writes SVG bytes as a fake .png and PowerPoint
    // refuses to open the file ("can't read" / corrupted). Also reject PNG/JPEG
    // mime types whose payload is actually SVG markup.
    if (
      dataUri?.startsWith("data:image/") &&
      !dataUri.startsWith("data:image/svg") &&
      !isSvgBase64Payload(dataUri)
    ) {
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
          rounding: true,
          hyperlink,
        });
        return;
      }
    }
    // Fallback letter mark only — no ring/chrome behind real icons.
    slide.addShape("ellipse", {
      x: iconX,
      y,
      w: size,
      h: size,
      fill: { color: SOFT_BLUE },
      line: { type: "none" },
      hyperlink,
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
  return unique.length > 0 ? size + (unique.length - 1) * step : 0;
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
  applyContentCurveAccent(slide);
}

function applyClosingBackground(slide: Slide): void {
  // Match cover blue gradient (reference Redesign revised) — not black/navy.
  applyCoverBackground(slide);
}

function applyContentCurveAccent(slide: Slide): void {
  // Soft top-right curve so white slides match the reference deck background.
  slide.addShape("ellipse", {
    x: 8.2,
    y: -3.4,
    w: 8.6,
    h: 8.6,
    fill: { color: "C9DBFF", transparency: 62 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: -3.8,
    y: 4.8,
    w: 7.2,
    h: 7.2,
    fill: { color: "E8F0FF", transparency: 70 },
    line: { type: "none" },
  });
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
  if (rowCount <= 4) return 0.28;
  if (rowCount <= 6) return 0.26;
  return 0.24;
}

function estimateDeliverableRowHeight(service: string, colWidthInches: number, fontSize: number): number {
  const text = service?.trim() || "—";
  const charsPerLine = Math.max(18, Math.floor(colWidthInches * (11.5 * (11 / fontSize))));
  const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
  return Math.min(0.72, Math.max(0.26, lines * 0.16 + 0.08));
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
  const head = finalBuffer.slice(0, 5).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.startsWith("<?xml")) {
    // SVG bytes break PowerPoint when pptxgenjs stores them as .png.
    return null;
  }
  const contentType = cropped?.contentType ?? detectImageContentType(finalBuffer);
  if (contentType.includes("svg")) return null;
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
  const showcase = isShowcaseTemplate(doc.template);
  const pitch = isPitchTemplate(doc.template);

  addBrandLockup(slide, "light", 0.5, 0.45);

  if (!showcase) {
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
  }

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

  // Showcase cover matches HTML redesign: 4 compact meta fields, no version/status chip.
  const metaCells: Array<[string, string]> = showcase
    ? [
        ["Quotation No.", payload.quotation.number],
        ["Client", payload.quotation.client],
        ["Brand", payload.quotation.brand],
        [
          "Issue · Valid",
          `${payload.quotation.issueDate} · ${payload.quotation.validUntil}`,
        ],
      ]
    : [
        ...(pitch ? [] : [["Quotation No.", payload.quotation.number] as [string, string]]),
        ["Client", payload.quotation.client],
        ["Brand", payload.quotation.brand],
        ...(pitch
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
      value: showcase
        ? `${payload.campaign.creatorCount} · ${payload.campaign.tierSummary}`
        : payload.campaign.creatorCount,
      sub: showcase ? "" : payload.campaign.tierSummary,
    },
    {
      label: payload.cover.stat3.label,
      // Full total cost as the hero figure (not abbreviated …K).
      value: payload.cover.stat3.value,
      sub: showcase ? "" : payload.cover.stat3.valueShort,
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
      fontSize: showcase ? 22 : 28,
      bold: true,
      color: WHITE,
    });
    if (stat.sub) {
      slide.addText(stat.sub, {
        x: x + 0.28,
        y: statY + 0.82,
        w: statW - 0.5,
        h: 0.24,
        fontFace: FONT_UI,
        fontSize: 11,
        color: COVER_KICKER,
      });
    }
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

type MixTableRow = {
  handle: string;
  platformLabel: string;
  platformIcons: string[];
  followers: string;
  category: string;
  er: string;
  fee: string;
  profileUrl: string | null;
};

/** Keep mix tables short so wrapped platform rows never collide with the footer. */
const MIX_ROWS_PER_SLIDE = 8;
const MIX_ROW_H = 0.24;
const MIX_HEADER_H = 0.26;

function resolveMixCreatorFee(
  handle: string,
  feeLines: ReturnType<typeof buildQuotationTemplatePayload>["feeLines"],
  showFees: boolean
): string {
  if (!showFees) return "";
  const key = handle.replace(/^@/, "").toLowerCase();
  const match = feeLines.find((line) => {
    const creatorKey = line.creator.replace(/^@/, "").toLowerCase();
    const avatarKey = (line.avatarGroupKey ?? "").replace(/^@/, "").toLowerCase();
    return creatorKey === key || avatarKey === key;
  });
  return match?.grossFee ?? "—";
}

function buildMixRowsForTier(
  tier: ReturnType<typeof buildQuotationTemplatePayload>["tiers"][number],
  doc: QuotationDocument,
  options: { perPlatform: boolean; showFees: boolean; feeLines: ReturnType<typeof buildQuotationTemplatePayload>["feeLines"] }
): MixTableRow[] {
  const mixRows: MixTableRow[] = [];
  for (const creator of tier.creators) {
    const group = doc.creatorGroups.find(
      (entry) =>
        entry.handle === creator.handle ||
        entry.handle.replace(/^@/, "") === creator.handle.replace(/^@/, "")
    );
    const metrics = group?.platformMetrics ?? [];
    const fee = resolveMixCreatorFee(creator.handle, options.feeLines, options.showFees);
    if (options.perPlatform && metrics.length > 0) {
      metrics.forEach((metric, metricIndex) => {
        mixRows.push({
          handle: metricIndex === 0 ? creator.handle : "",
          platformLabel: getReportPlatformIconTitle(metric.platform),
          platformIcons: [metric.platform],
          followers: metric.followers,
          category: metricIndex === 0 ? creator.category : "",
          er: metric.engagement,
          fee: metricIndex === 0 ? fee : "",
          profileUrl: metric.profileUrl ?? creator.profileUrl,
        });
      });
    } else {
      mixRows.push({
        handle: creator.handle,
        platformLabel: creator.platform,
        platformIcons: creator.platformIcons,
        followers: creator.followers,
        category: creator.category,
        er: creator.er,
        fee,
        profileUrl: creator.profileUrl,
      });
    }
  }
  return mixRows;
}

/** Full-width category bars — matches LineItem reference (not a 4-up card grid). */
function drawMixCategoryCards(
  slide: Slide,
  categories: ReturnType<typeof buildQuotationTemplatePayload>["categories"],
  y: number
): number {
  if (!categories.length) return y;
  const barH = 0.48;
  const gap = 0.1;
  categories.forEach((cat, index) => {
    const barY = y + index * (barH + gap);
    slide.addShape("roundRect", {
      x: MARGIN_X,
      y: barY,
      w: CONTENT_W,
      h: barH,
      fill: { color: WHITE, transparency: GLASS_CARD_TRANSPARENCY },
      line: { color: HAIR, width: 1 },
      rectRadius: 0.08,
    });
    slide.addText(cat.name.toUpperCase(), {
      x: MARGIN_X + 0.18,
      y: barY + 0.1,
      w: CONTENT_W * 0.45,
      h: 0.28,
      fontFace: FONT_UI,
      fontSize: 12,
      bold: true,
      color: TITLE_INK,
      valign: "middle",
    });
    slide.addText(cat.count, {
      x: MARGIN_X + CONTENT_W * 0.5,
      y: barY + 0.08,
      w: 1.2,
      h: 0.32,
      fontFace: FONT_UI,
      fontSize: 20,
      bold: true,
      color: TITLE_INK,
      align: "right",
      valign: "middle",
    });
    slide.addText(`${cat.countLabel} · ${cat.share}`, {
      x: MARGIN_X + CONTENT_W * 0.5 + 1.35,
      y: barY + 0.1,
      w: CONTENT_W * 0.5 - 1.55,
      h: 0.28,
      fontFace: FONT_BODY,
      fontSize: 12,
      color: MUTED,
      valign: "middle",
    });
  });
  return y + categories.length * (barH + gap) + 0.08;
}

function drawMixTierTable(
  slide: Slide,
  tier: ReturnType<typeof buildQuotationTemplatePayload>["tiers"][number],
  visibleRows: MixTableRow[],
  cursorY: number,
  options: { perPlatform: boolean; showFees: boolean }
): number {
  const { perPlatform, showFees } = options;
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

  // No Views column on any template. Showcase/pitch add Fees (EGP).
  const colW = showFees
    ? [2.1, 1.45, 1.55, 3.2, 1.35, 2.48]
    : [2.4, 1.6, 1.7, 3.8, 1.63];
  const header = [
    { text: "Creator", options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } } },
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
    ...(showFees
      ? [
          {
            text: "Fees (EGP)",
            options: {
              bold: true,
              color: MUTED,
              fontSize: 9,
              fill: { color: WHITE },
              align: "right" as const,
            },
          },
        ]
      : []),
  ];
  const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
    header,
    ...visibleRows.map((row) => {
      const handleLink = profileHyperlink(row.profileUrl);
      return [
        {
          text: row.handle,
          options: {
            fontSize: 10,
            bold: Boolean(row.handle),
            color: TITLE_INK,
            ...(handleLink && row.handle ? { hyperlink: handleLink } : {}),
          },
        },
        {
          text: perPlatform ? "" : row.platformLabel,
          options: { fontSize: 10, color: TITLE_INK },
        },
        {
          text: row.followers,
          options: { fontSize: 10, color: TITLE_INK, align: "right" },
        },
        { text: row.category, options: { fontSize: 9, color: TITLE_INK } },
        {
          text: row.er,
          options: { fontSize: 10, color: TITLE_INK, align: "right" },
        },
        ...(showFees
          ? [
              {
                text: row.fee,
                options: { fontSize: 10, bold: Boolean(row.fee), color: BLUE, align: "right" as const },
              },
            ]
          : []),
      ];
    }),
  ];

  const tableY = cursorY + 0.34;
  const tableH = (visibleRows.length + 1) * MIX_ROW_H;
  slide.addTable(rows, {
    x: MARGIN_X,
    y: tableY,
    w: 12.13,
    colW,
    border: { type: "solid", pt: 0.5, color: ROW_HAIR },
    fontFace: FONT_BODY,
    autoPage: false,
    rowH: MIX_ROW_H,
    h: tableH,
    align: "left",
    valign: "middle",
  });

  if (perPlatform) {
    const platformsColX = MARGIN_X + colW[0]! + 0.1;
    visibleRows.forEach((row, index) => {
      if (!row.platformIcons.length) return;
      addPlatformIconBadges(
        slide,
        row.platformIcons,
        platformsColX,
        tableY + MIX_ROW_H * (index + 1) + Math.max((MIX_ROW_H - 0.18) / 2, 0.02),
        1,
        row.profileUrl,
        0.18
      );
    });
  }

  return tableY + tableH + 0.22;
}

const INVESTMENT_BANNER_H = 0.95;

function splitCommercialMoneyParts(full: string): { currency: string; amount: string } {
  const match = full.trim().match(/^([A-Z]{3})\s+(.+)$/);
  if (match) return { currency: match[1]!, amount: match[2]! };
  return { currency: "EGP", amount: full.trim() || "—" };
}

/** Redesign HTML banner — TOTAL INVESTMENT · N CREATORS · CURRENCY + amount. */
function drawTotalInvestmentBanner(
  slide: Slide,
  doc: QuotationDocument,
  y: number
): number {
  const payload = buildQuotationTemplatePayload(doc);
  const money = splitCommercialMoneyParts(payload.commercial.headlineValue || "EGP —");
  slide.addShape("roundRect", {
    x: MARGIN_X,
    y,
    w: CONTENT_W,
    h: INVESTMENT_BANNER_H,
    fill: { color: BLUE },
    line: { type: "none" },
    rectRadius: 0.12,
  });
  slide.addText(
    `TOTAL INVESTMENT · ${payload.totals.creatorCount} CREATORS · ${money.currency}`,
    {
      x: MARGIN_X + 0.28,
      y: y + 0.16,
      w: CONTENT_W - 0.56,
      h: 0.26,
      fontFace: FONT_UI,
      fontSize: 11,
      bold: true,
      color: WHITE,
      charSpacing: 1.0,
    }
  );
  slide.addText(money.amount, {
    x: MARGIN_X + 0.28,
    y: y + 0.42,
    w: CONTENT_W - 0.56,
    h: 0.42,
    fontFace: FONT_UI,
    fontSize: 26,
    bold: true,
    color: WHITE,
  });
  return y + INVESTMENT_BANNER_H + 0.1;
}

function addCreatorMixSummarySlide(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  // Showcase / Showcase Lump Sum use the redesign TOTAL INVESTMENT banner instead.
  if (isShowcaseTemplate(doc.template)) {
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const pageNo = nextSlideNo(counter);
    let cursorY = addSectionHeader(slide, "01 · INVESTMENT SUMMARY", "Creators & fees");
    cursorY = drawTotalInvestmentBanner(slide, doc, cursorY + 0.2);
    addSlideFooter(slide, `${doc.serial} · Summary`, pageNo);
    return;
  }

  const payload = buildQuotationTemplatePayload(doc);
  const slide = pptx.addSlide();
  applyContentBackground(slide);
  const pageNo = nextSlideNo(counter);
  addSectionHeader(slide, "SECTION 01 · CREATOR MIX", "Mix summary");

  const footerBlockY = 2.2;
  slide.addShape("roundRect", {
    x: MARGIN_X,
    y: footerBlockY,
    w: 12.13,
    h: 1.1,
    fill: { color: WHITE },
    line: { color: HAIR, width: 1 },
    rectRadius: 0.12,
  });
  slide.addText(`Grand total · ${payload.totals.creatorCount} influencers`, {
    x: 0.9,
    y: footerBlockY + 0.18,
    w: 6.5,
    h: 0.36,
    fontFace: FONT_UI,
    fontSize: 18,
    bold: true,
    color: TITLE_INK,
  });
  slide.addText(`FOLLOWERS\n${payload.totals.followers}`, {
    x: 7.2,
    y: footerBlockY + 0.2,
    w: 2.4,
    h: 0.7,
    fontFace: FONT_BODY,
    fontSize: 13,
    color: MUTED_SOFT,
    align: "right",
  });
  slide.addText(`AVG ER\n${payload.totals.avgER}`, {
    x: 9.8,
    y: footerBlockY + 0.2,
    w: 2.5,
    h: 0.7,
    fontFace: FONT_BODY,
    fontSize: 13,
    color: MUTED_SOFT,
    align: "right",
  });

  const insightParts = [
    payload.insight.categoryMix,
    payload.insight.tierMix,
    payload.insight.scale,
  ]
    .filter(Boolean)
    .join("  ");
  if (insightParts) {
    const insightY = footerBlockY + 1.35;
    slide.addShape("roundRect", {
      x: MARGIN_X,
      y: insightY,
      w: 12.13,
      h: 1.2,
      fill: { color: INSIGHT_BG },
      line: { type: "none" },
      rectRadius: 0.12,
    });
    slide.addShape("roundRect", {
      x: 0.9,
      y: insightY + 0.38,
      w: 0.4,
      h: 0.4,
      fill: { color: SOFT_BLUE },
      line: { type: "none" },
      rectRadius: 0.1,
    });
    slide.addText("✦", {
      x: 0.9,
      y: insightY + 0.38,
      w: 0.4,
      h: 0.4,
      fontFace: FONT_UI,
      fontSize: 13,
      color: BLUE,
      align: "center",
      valign: "middle",
    });
    slide.addText("Campaign mix insight", {
      x: 1.5,
      y: insightY + 0.22,
      w: 10.8,
      h: 0.28,
      fontFace: FONT_UI,
      fontSize: 13,
      bold: true,
      color: TITLE_INK,
    });
    slide.addText(insightParts, {
      x: 1.5,
      y: insightY + 0.54,
      w: 10.8,
      h: 0.5,
      fontFace: FONT_BODY,
      fontSize: 12,
      color: TITLE_INK,
    });
  }

  addSlideFooter(slide, `${doc.serial} · Creator mix summary`, pageNo);
}

function addCreatorMixSlides(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  const payload = buildQuotationTemplatePayload(doc);
  // One row per platform for every template (lead handle / blank continuations).
  const perPlatform = true;
  const showcaseMix = isShowcaseTemplate(doc.template) || isPitchTemplate(doc.template);
  const showFees = showcaseMix && payload.flags.showFees;
  const maxCats = isPitchTemplate(doc.template) ? 6 : 4;
  const categoryCards = showcaseMix ? [] : payload.categories.slice(0, maxCats);

  type MixChunk = {
    tier: (typeof payload.tiers)[number];
    rows: MixTableRow[];
    continued: boolean;
  };
  const chunks: MixChunk[] = [];
  for (const tier of payload.tiers) {
    const allRows = buildMixRowsForTier(tier, doc, {
      perPlatform,
      showFees,
      feeLines: payload.feeLines,
    });
    if (!allRows.length) continue;
    for (let offset = 0; offset < allRows.length; offset += MIX_ROWS_PER_SLIDE) {
      chunks.push({
        tier,
        rows: allRows.slice(offset, offset + MIX_ROWS_PER_SLIDE),
        continued: offset > 0,
      });
    }
  }
  if (!chunks.length) {
    // Still show categories + summary for empty tiers.
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const pageNo = nextSlideNo(counter);
    let cursorY = addSectionHeader(
      slide,
      showcaseMix ? "01 · INVESTMENT SUMMARY" : "SECTION 01 · CREATOR MIX",
      showcaseMix ? "Creators & fees" : "Creator mix"
    );
    cursorY = drawMixCategoryCards(slide, categoryCards, cursorY + 0.1);
    if (isShowcaseTemplate(doc.template)) {
      drawTotalInvestmentBanner(slide, doc, Math.max(cursorY + 0.2, 4.2));
      addSlideFooter(slide, `${doc.serial} · Summary`, pageNo);
      return;
    }
    addSlideFooter(slide, `${doc.serial} · Creator mix`, pageNo);
    addCreatorMixSummarySlide(pptx, doc, counter);
    return;
  }

  let slideIndex = 0;
  let slide: Slide | null = null;
  let cursorY = 0;
  let pageNo = "00";
  const mixFooterLabel = isShowcaseTemplate(doc.template)
    ? `${doc.serial} · Summary`
    : `${doc.serial} · Creator mix`;

  const startSlide = (continued: boolean) => {
    slide = pptx.addSlide();
    applyContentBackground(slide);
    pageNo = nextSlideNo(counter);
    slideIndex += 1;
    cursorY = addSectionHeader(
      slide,
      showcaseMix ? "01 · INVESTMENT SUMMARY" : "01 · CREATORS BY CATEGORY",
      showcaseMix
        ? continued || slideIndex > 1
          ? "Creators & fees (continued)"
          : "Creators & fees"
        : continued || slideIndex > 1
          ? "Creator mix (continued)"
          : "Creator mix"
    );
    if (slideIndex === 1 && categoryCards.length) {
      cursorY = drawMixCategoryCards(slide, categoryCards, cursorY + 0.08);
    }
  };

  startSlide(false);

  for (const chunk of chunks) {
    const blockH = 0.34 + MIX_HEADER_H + chunk.rows.length * MIX_ROW_H + 0.22;
    if (cursorY + blockH > CONTENT_BOTTOM) {
      addSlideFooter(
        slide!,
        `${mixFooterLabel}${slideIndex > 1 ? ` · ${slideIndex}` : ""}`,
        pageNo
      );
      startSlide(true);
    }
    cursorY = drawMixTierTable(slide!, chunk.tier, chunk.rows, cursorY, {
      perPlatform,
      showFees,
    });
  }

  if (isShowcaseTemplate(doc.template)) {
    // Prefer redesign TOTAL INVESTMENT banner on the last mix slide when it fits.
    if (cursorY + INVESTMENT_BANNER_H + 0.12 <= CONTENT_BOTTOM) {
      drawTotalInvestmentBanner(slide!, doc, cursorY + 0.12);
      addSlideFooter(
        slide!,
        `${mixFooterLabel}${slideIndex > 1 ? ` · ${slideIndex}` : ""}`,
        pageNo
      );
      return;
    }
    addSlideFooter(
      slide!,
      `${mixFooterLabel}${slideIndex > 1 ? ` · ${slideIndex}` : ""}`,
      pageNo
    );
    addCreatorMixSummarySlide(pptx, doc, counter);
    return;
  }

  addSlideFooter(
    slide!,
    `${mixFooterLabel}${slideIndex > 1 ? ` · ${slideIndex}` : ""}`,
    pageNo
  );
  // Detailed decks keep totals/insight on a dedicated slide — never over a table.
  addCreatorMixSummarySlide(pptx, doc, counter);
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
  const serviceColW = colW[1]!;
  const baseRowH = creatorTableRowHeight(deliverables.length);
  const bodyRowHeights = deliverables.map((row) =>
    Math.max(baseRowH, estimateDeliverableRowHeight(row.service, serviceColW, tableFontSize))
  );
  const tableRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
    header.map((cell) => ({
      text: cell,
      options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } },
    })),
    ...deliverables.map((row) => {
      // Icon badges are drawn into the Platform cell — keep cell text empty when icons exist.
      const platformText = row.platformIcons.length ? "" : row.platform;
      const cells = [row.option, row.service, platformText, row.type];
      if (showFees) cells.push(row.grossFee ?? "-");
      return cells.map((cell, cellIndex) => ({
        text: cell,
        options: {
          fontSize: tableFontSize,
          color: TITLE_INK,
          valign: cellIndex === 1 ? "top" : "middle",
        },
      }));
    }),
  ];

  const headerH = 0.26;
  // pptxgenjs accepts a single rowH; use the tallest body row so wrapped
  // service descriptions are never clipped.
  const rowH = Math.max(baseRowH, ...bodyRowHeights, headerH);
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

  const platformColX = MARGIN_X + colW[0]! + colW[1]! + 0.1;
  let rowOffset = headerH;
  deliverables.forEach((row) => {
    if (row.platformIcons.length) {
      addPlatformIconBadges(
        slide,
        row.platformIcons,
        platformColX,
        y + rowOffset + Math.max((rowH - 0.18) / 2, 0.04)
      );
    }
    rowOffset += rowH;
  });

  return y + headerH + deliverables.length * rowH + 0.2;
}

function creatorPlatformMetricRows(
  creator: ReturnType<typeof buildQuotationTemplatePayload>["showcaseCreators"][number]
) {
  if (creator.platformMetrics.length > 0) return creator.platformMetrics;
  return [
    {
      platform: creator.platformIcons[0] ?? "instagram",
      followers: creator.followers,
      engagement: creator.engagement,
      views: creator.views,
      profileUrl: creator.profileUrl ?? null,
      avatarUrl: creator.avatarUrl ?? null,
    },
  ];
}

/** One metrics row per linked platform — Followers / ER only (Views removed). */
function addCreatorMetricsTable(
  slide: Slide,
  creator: ReturnType<typeof buildQuotationTemplatePayload>["showcaseCreators"][number],
  x: number,
  y: number,
  w: number
): number {
  const metricRows = creatorPlatformMetricRows(creator);
  const rowH = metricRows.length > 3 ? 0.26 : 0.3;
  const colW = [w * 0.18, w * 0.17, w * 0.14, w * 0.28, w * 0.23];
  const bodyRows = metricRows.map((row, index) => [
    {
      text: row.followers,
      options: { fontSize: 10, bold: index === 0, color: TITLE_INK },
    },
    {
      text: row.engagement,
      options: { fontSize: 10, bold: index === 0, color: TITLE_INK },
    },
    {
      text: index === 0 ? creator.tier : "",
      options: { fontSize: 10, color: TITLE_INK },
    },
    {
      text: index === 0 ? creator.categories : "",
      options: { fontSize: 9, color: TITLE_INK },
    },
    // Leave blank — platform icon badge is drawn in this cell.
    { text: "", options: { fontSize: 9, color: TITLE_INK } },
  ]);

  slide.addTable(
    [
      [
        { text: "Followers", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Engagement", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Tier", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Category", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
        { text: "Platform", options: { bold: true, color: WHITE, fontSize: 8, fill: { color: NAVY } } },
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

  const platformsColX = x + colW.slice(0, 4).reduce((sum, value) => sum + value, 0) + 0.08;
  metricRows.forEach((row, index) => {
    addPlatformIconBadges(
      slide,
      [row.platform],
      platformsColX,
      y + rowH * (index + 1) + (rowH - 0.18) / 2,
      1,
      row.profileUrl ?? creator.profileUrl
    );
  });

  return y + rowH * (metricRows.length + 1) + 0.12;
}

function creatorDeliverableSummary(
  creator: ReturnType<typeof buildQuotationTemplatePayload>["showcaseCreators"][number]
): { summary: string; feeLabel: string | null } {
  const summary = creator.deliverables
    .map((row) => row.service.trim())
    .filter(Boolean)
    .join(" + ") || "—";
  const fees = creator.deliverables
    .map((row) => {
      const raw = row.grossFee?.replace(/[^\d.]/g, "") ?? "";
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })
    .filter((n): n is number => n != null);
  const total = fees.reduce((a, b) => a + b, 0);
  if (!fees.length) return { summary, feeLabel: null };
  return {
    summary,
    feeLabel: `EGP ${Math.round(total).toLocaleString("en-US")}`,
  };
}

function drawShowcaseMetricCards(
  slide: Slide,
  creator: ReturnType<typeof buildQuotationTemplatePayload>["showcaseCreators"][number],
  y: number
): number {
  const engagementValue = formatShowcaseEngagementCardValue({
    engagement: creator.engagement,
    platformMetrics: creator.platformMetrics,
  });
  const cards: Array<{ label: string; value: string; accent?: boolean; compact?: boolean }> = [
    { label: "FOLLOWERS", value: creator.followers, accent: true },
    {
      label: "ENGAGEMENT",
      value: engagementValue,
      compact: engagementValue.includes(" · "),
    },
  ];
  for (const metric of creator.platformMetrics) {
    if (cards.length >= 4) break;
    const label = getReportPlatformIconTitle(metric.platform).toUpperCase();
    if (cards.some((card) => card.label === label)) continue;
    cards.push({ label, value: metric.followers });
  }
  const gap = 0.14;
  const cardW = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    const x = MARGIN_X + index * (cardW + gap);
    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: 0.7,
      fill: { color: WHITE },
      line: { color: HAIR, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(card.label, {
      x: x + 0.12,
      y: y + 0.08,
      w: cardW - 0.24,
      h: 0.18,
      fontFace: FONT_UI,
      fontSize: 9,
      bold: true,
      color: MUTED,
      charSpacing: 1,
    });
    slide.addText(card.value, {
      x: x + 0.12,
      y: y + 0.28,
      w: cardW - 0.24,
      h: 0.34,
      fontFace: FONT_UI,
      fontSize: card.compact ? 12 : 18,
      bold: true,
      color: card.accent ? BLUE : TITLE_INK,
      valign: "middle",
    });
  });
  return y + 0.82;
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
  const pubCols = 4;
  const pubLimit = 4;
  const pubGap = 0.14;

  const handleForUrl = creator.handle.replace(/^@/, "").trim();
  const synthesizedProfileUrl =
    handleForUrl && handleForUrl !== "—"
      ? resolveCreatorProfileUrl({
          platform: creator.platformIcons[0] ?? "instagram",
          handle: handleForUrl,
          profile_url: creator.profileUrl ?? group.profileUrl,
        })
      : null;
  const profileLink = resolveCreatorProfileHref(creator.profileUrl ?? group.profileUrl, [
    ...creator.platformMetrics.map((row) => row.profileUrl),
    ...group.platformMetrics.map((row) => row.profileUrl),
    synthesizedProfileUrl,
  ]);
  // Never show INF-xxxx; fall back to username when no real creator name exists.
  const displayName = pickCreatorDisplayName([creator.name, creator.handle], creator.handle);

  const slide = pptx.addSlide();
  applyContentBackground(slide);
  const pageNo = nextSlideNo(counter);
  addBrandLockup(slide, "dark", 0.42, 0.28);

  slide.addText(`CREATOR ${creator.index} OF ${payload.totals.creatorCount}`, {
    x: MARGIN_X,
    y: 0.88,
    w: 10,
    h: 0.2,
    fontFace: FONT_UI,
    fontSize: 11,
    bold: true,
    color: BLUE,
    charSpacing: 1.4,
  });
  slide.addText(displayName, {
    x: MARGIN_X,
    y: 1.1,
    w: CONTENT_W,
    h: 0.36,
    fontFace: FONT_UI,
    fontSize: 28,
    bold: true,
    color: TITLE_INK,
    ...(profileLink ? { hyperlink: profileLink } : {}),
  });
  slide.addText(creator.handle, {
    x: MARGIN_X,
    y: 1.44,
    w: CONTENT_W,
    h: 0.24,
    fontFace: FONT_BODY,
    fontSize: 14,
    color: MUTED,
    ...(profileLink ? { hyperlink: profileLink } : {}),
  });

  const avatarSize = pitch ? Math.min(PITCH_AVATAR_SIZE, 1.1) : 0.82;
  const avatarY = 1.72;
  await addThinkwayCreatorAvatar(slide, {
    avatarUrl: group.avatarUrl,
    initials: creator.initials,
    x: MARGIN_X,
    y: avatarY,
    size: avatarSize,
    pitch,
    profileHref: profileLink?.url ?? creator.profileUrl ?? group.profileUrl,
  });

  const nameX = MARGIN_X + avatarSize + 0.24;
  // Tier pill
  slide.addShape("roundRect", {
    x: nameX,
    y: avatarY + 0.02,
    w: Math.min(1.15, 0.55 + creator.tier.length * 0.1),
    h: 0.26,
    fill: { color: "EEF3FF" },
    line: { type: "none" },
    rectRadius: 0.14,
  });
  slide.addText(creator.tier.toUpperCase(), {
    x: nameX,
    y: avatarY + 0.02,
    w: Math.min(1.15, 0.55 + creator.tier.length * 0.1),
    h: 0.26,
    fontFace: FONT_UI,
    fontSize: 10,
    bold: true,
    color: BLUE,
    align: "center",
    valign: "middle",
  });
  slide.addText(creator.categories, {
    x: nameX + Math.min(1.15, 0.55 + creator.tier.length * 0.1) + 0.12,
    y: avatarY + 0.04,
    w: 4,
    h: 0.22,
    fontFace: FONT_BODY,
    fontSize: 13,
    color: MUTED,
    valign: "middle",
  });
  slide.addText(displayName, {
    x: nameX,
    y: avatarY + 0.34,
    w: 6,
    h: 0.22,
    fontFace: FONT_UI,
    fontSize: 14,
    bold: true,
    color: TITLE_INK,
    ...(profileLink ? { hyperlink: profileLink } : {}),
  });
  slide.addText(creator.handle, {
    x: nameX,
    y: avatarY + 0.56,
    w: 6,
    h: 0.2,
    fontFace: FONT_BODY,
    fontSize: 12,
    color: MUTED,
    ...(profileLink ? { hyperlink: profileLink } : {}),
  });
  const platformLabel = creator.platformIcons
    .map((platform) => getReportPlatformIconTitle(platform))
    .join(" · ");
  addPlatformIconBadges(
    slide,
    creator.platformIcons,
    nameX,
    avatarY + 0.8,
    6,
    profileLink?.url ?? creator.profileUrl ?? group.profileUrl,
    0.18,
    { overlap: true }
  );
  slide.addText(platformLabel || creator.platforms, {
    x: nameX + creator.platformIcons.length * 0.2 + 0.08,
    y: avatarY + 0.78,
    w: 5,
    h: 0.22,
    fontFace: FONT_BODY,
    fontSize: 12,
    color: MUTED,
    valign: "middle",
  });

  let contentY = drawShowcaseMetricCards(slide, creator, avatarY + avatarSize + 0.12);

  const { summary, feeLabel } = creatorDeliverableSummary(creator);
  const barY = CONTENT_BOTTOM - 0.78;
  // Full-width publication row (match reference Redesign) — size by width, clamp by height.
  const widthThumb = (CONTENT_W - pubGap * (pubCols - 1)) / pubCols;
  const heightThumb = Math.max(1.25, barY - contentY - 0.4);
  const pubThumbSize = Math.min(widthThumb, heightThumb);

  if (group.publicationShots.length > 0) {
    contentY = await addPublicationThumbs(
      slide,
      group.publicationShots.slice(0, pubLimit),
      contentY + 0.02,
      "Recent publications",
      pubCols,
      pubThumbSize,
      {
        centered: false,
        gap: pubGap,
        frameless: true,
      }
    );
  }
  slide.addShape("roundRect", {
    x: MARGIN_X,
    y: barY,
    w: CONTENT_W,
    h: 0.72,
    fill: { color: "F6F8FF" },
    line: { color: HAIR, width: 1 },
    rectRadius: 0.12,
  });
  slide.addText("PROPOSED DELIVERABLE", {
    x: MARGIN_X + 0.22,
    y: barY + 0.1,
    w: showFees && feeLabel ? 8.2 : CONTENT_W - 0.44,
    h: 0.18,
    fontFace: FONT_UI,
    fontSize: 9,
    bold: true,
    color: MUTED,
    charSpacing: 1,
  });
  slide.addText(summary, {
    x: MARGIN_X + 0.22,
    y: barY + 0.32,
    w: showFees && feeLabel ? 8.2 : CONTENT_W - 0.44,
    h: 0.3,
    fontFace: FONT_BODY,
    fontSize: 12,
    bold: true,
    color: TITLE_INK,
  });
  if (showFees && feeLabel) {
    const pillW = Math.min(2.4, 1.2 + feeLabel.length * 0.09);
    slide.addShape("roundRect", {
      x: MARGIN_X + CONTENT_W - pillW - 0.18,
      y: barY + 0.14,
      w: pillW,
      h: 0.44,
      fill: { color: BLUE },
      line: { type: "none" },
      rectRadius: 0.22,
    });
    slide.addText(feeLabel, {
      x: MARGIN_X + CONTENT_W - pillW - 0.18,
      y: barY + 0.14,
      w: pillW,
      h: 0.44,
      fontFace: FONT_UI,
      fontSize: 13,
      bold: true,
      color: WHITE,
      align: "center",
      valign: "middle",
    });
  }

  addSlideFooter(slide, `${doc.serial} · ${creator.handle}`, pageNo);
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
  const fieldBottom = y + h - 0.2 - Math.min(pkg.creators.length, 4) * 0.42 - 0.35;
  for (const [label, value] of fields) {
    const valueH = estimateDeliverableRowHeight(String(value ?? "—"), innerW, 11);
    if (fieldY + 0.16 + valueH > fieldBottom) break;
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
    slide.addText(String(value ?? "—"), {
      x: x + pad,
      y: fieldY + 0.15,
      w: innerW,
      h: valueH,
      fontFace: FONT_BODY,
      fontSize: 11,
      color: TITLE_INK,
      valign: "top",
    });
    fieldY += 0.2 + valueH;
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

/** Per-platform roster rows — keep clear of footer. */
const ROSTER_ROWS_PER_SLIDE = 9;
const ROSTER_ROWS_FIRST_SLIDE = 7;
const ROSTER_ROW_H = 0.34;

type RosterPptxRow = {
  handle: string;
  initials: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  followers: string;
  er: string;
  tier: string;
  categories: string;
  platformIcons: string[];
  lead: boolean;
};

function expandRosterPptxRows(
  doc: QuotationDocument,
  payload: ReturnType<typeof buildQuotationTemplatePayload>
): RosterPptxRow[] {
  const rows: RosterPptxRow[] = [];
  payload.roster.rows.forEach((row, index) => {
    const group = doc.creatorGroups[index];
    const metrics = group?.platformMetrics ?? [];
    if (metrics.length > 0) {
      metrics.forEach((metric, metricIndex) => {
        rows.push({
          handle: metricIndex === 0 ? row.handle : "",
          initials: row.initials,
          avatarUrl: metricIndex === 0 ? row.avatarUrl ?? null : null,
          profileUrl: metric.profileUrl ?? row.profileUrl ?? null,
          followers: metric.followers,
          er: metric.engagement,
          tier: metricIndex === 0 ? row.tier : "",
          categories: metricIndex === 0 ? row.categories : "",
          platformIcons: [metric.platform],
          lead: metricIndex === 0,
        });
      });
      return;
    }
    rows.push({
      handle: row.handle,
      initials: row.initials,
      avatarUrl: row.avatarUrl ?? null,
      profileUrl: row.profileUrl ?? null,
      followers: row.followers,
      er: row.er,
      tier: row.tier,
      categories: row.categories,
      platformIcons: row.platformIcons,
      lead: true,
    });
  });
  return rows;
}

function drawRosterKpiStrip(
  slide: Slide,
  payload: ReturnType<typeof buildQuotationTemplatePayload>,
  y: number
): number {
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
      y,
      w: kpiW,
      h: 0.72,
      fill: { color: WHITE },
      line: { color: HAIR, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(label, {
      x: x + 0.14,
      y: y + 0.1,
      w: kpiW - 0.28,
      h: 0.18,
      fontFace: FONT_UI,
      fontSize: 9,
      color: MUTED_SOFT,
      charSpacing: 0.8,
    });
    slide.addText(value, {
      x: x + 0.14,
      y: y + 0.32,
      w: kpiW - 0.28,
      h: 0.28,
      fontFace: FONT_UI,
      fontSize: 18,
      bold: true,
      color: TITLE_INK,
    });
  });
  return y + 0.88;
}

async function addRosterSlides(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): Promise<void> {
  const payload = buildQuotationTemplatePayload(doc);
  const allRows = expandRosterPptxRows(doc, payload);
  if (!allRows.length) return;

  const avatarSize = 0.22;
  const colW = [2.55, 1.45, 1.15, 1.2, 2.65, 3.13];
  const chunks: RosterPptxRow[][] = [];
  let offset = 0;
  while (offset < allRows.length) {
    const size = chunks.length === 0 ? ROSTER_ROWS_FIRST_SLIDE : ROSTER_ROWS_PER_SLIDE;
    chunks.push(allRows.slice(offset, offset + size));
    offset += size;
  }

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]!;
    const continued = chunkIndex > 0;
    const isFirst = chunkIndex === 0;
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const pageNo = nextSlideNo(counter);

    let cursorY = addSectionHeader(
      slide,
      `SECTION ${payload.roster.sectionNo} · CREATOR ROSTER`,
      continued ? "At a glance (continued)" : "At a glance"
    );

    // KPIs on the first roster slide only — above the table, never over rows.
    if (isFirst) {
      cursorY = drawRosterKpiStrip(slide, payload, cursorY + 0.06);
    }

    const tableY = cursorY + 0.06;
    const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
      [
        { text: "Creator", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
        { text: "Followers", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
        { text: "Eng %", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
        { text: "Tier", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
        { text: "Category", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
        { text: "Platforms", options: { bold: true, color: WHITE, fontSize: 9, fill: { color: NAVY } } },
      ],
      ...chunk.map((row) => {
        const handleLink = row.lead ? resolveCreatorProfileHref(row.profileUrl) : undefined;
        return [
          {
            text: row.handle,
            options: {
              fontSize: 9,
              bold: Boolean(row.handle),
              color: TITLE_INK,
              margin: [0.04, 0.04, 0.04, 0.34] as [number, number, number, number],
              ...(handleLink ? { hyperlink: handleLink } : {}),
            },
          },
          { text: row.followers, options: { fontSize: 9, color: TITLE_INK } },
          { text: row.er, options: { fontSize: 9, color: TITLE_INK } },
          { text: row.tier, options: { fontSize: 9, color: TITLE_INK } },
          { text: row.categories, options: { fontSize: 9, color: TITLE_INK } },
          { text: "", options: { fontSize: 9, color: TITLE_INK } },
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
      rowH: ROSTER_ROW_H,
      h: 0.26 + chunk.length * ROSTER_ROW_H,
    });

    const platformColX = MARGIN_X + colW.slice(0, 5).reduce((sum, value) => sum + value, 0) + 0.08;
    for (let index = 0; index < chunk.length; index++) {
      const row = chunk[index]!;
      const rowTop = tableY + ROSTER_ROW_H * (index + 1);
      const rosterLink = resolveCreatorProfileHref(row.profileUrl);
      if (row.lead) {
        await addThinkwayCreatorAvatar(slide, {
          avatarUrl: row.avatarUrl ?? null,
          initials: row.initials,
          x: MARGIN_X + 0.08,
          y: rowTop + (ROSTER_ROW_H - avatarSize) / 2,
          size: avatarSize,
          pitch: false,
          profileHref: rosterLink?.url ?? row.profileUrl,
        });
      }
      if (row.platformIcons.length) {
        addPlatformIconBadges(
          slide,
          row.platformIcons,
          platformColX,
          rowTop + (ROSTER_ROW_H - 0.2) / 2,
          1,
          rosterLink?.url ?? row.profileUrl,
          0.2,
          { overlap: true }
        );
      }
    }

    addSlideFooter(
      slide,
      `${doc.serial} · Roster${continued ? ` · ${chunkIndex + 1}` : ""}`,
      pageNo
    );
  }
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

function addNotesSlides(
  pptx: PptxGen,
  doc: QuotationDocument,
  counter: SlideCounter
): void {
  const notes = doc.notes?.trim();
  if (!notes) return;

  const maxHeight = CONTENT_BOTTOM - 2.1;
  const chunks = chunkPptxWrappedText(notes, CONTENT_W, 12, maxHeight);

  chunks.forEach((chunk, index) => {
    const slide = pptx.addSlide();
    applyContentBackground(slide);
    const pageNo = nextSlideNo(counter);
    addSectionHeader(
      slide,
      index === 0 ? "SECTION · COMMERCIAL NOTES" : "SECTION · COMMERCIAL NOTES (CONTINUED)",
      index === 0 ? "Notes & recommendations" : "Notes continued"
    );
    const height = estimatePptxWrappedTextHeight({
      text: chunk,
      widthInches: CONTENT_W,
      fontSizePt: 12,
      minHeightInches: 0.5,
      maxHeightInches: maxHeight,
    });
    slide.addText(chunk, {
      x: MARGIN_X,
      y: 2.1,
      w: CONTENT_W,
      h: height,
      fontFace: FONT_BODY,
      fontSize: 12,
      color: TITLE_INK,
      valign: "top",
    });
    addSlideFooter(
      slide,
      `${doc.serial} · Notes${chunks.length > 1 ? ` · ${index + 1}` : ""}`,
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
    const bodyH = estimatePptxWrappedTextHeight({
      text: term.body,
      widthInches: colW,
      fontSizePt: 10,
      minHeightInches: 0.4,
      maxHeightInches: 0.95,
    });
    slide.addText(term.body, {
      x,
      y: y + 0.28,
      w: colW,
      h: bodyH,
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
  // RFQ_5 slide 14: navy glow image background (same asset as quotation close).
  applyClosingBackground(slide);
  addBrandLockup(slide, "light", 0.55, 0.5);
  nextSlideNo(counter);

  if (pitchClosing) {
    // RFQ accent bar under brand lockup (3D8BFF).
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
    await addRosterSlides(pptx, doc, counter);
  }

  const payload = buildQuotationTemplatePayload(doc);
  if (payload.flags.showCommercialSummary) {
    addCommercialSlides(pptx, doc, counter);
  }
  addNotesSlides(pptx, doc, counter);

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
  addNotesSlides(pptx, doc, counter);
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
