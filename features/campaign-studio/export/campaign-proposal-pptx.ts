import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  detectImageContentType,
  fetchImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";

import {
  buildCampaignProposalModel,
  buildProposalCloseHeadline,
  buildProposalStrategyTags,
  type CampaignProposalModel,
  type ProposalBranding,
  type ProposalVendor,
} from "./campaign-proposal-document";

// ---------------------------------------------------------------------------
// Reference deck palette (hex without # — pptxgenjs convention).
// Mirrors the proposal PDF: blue primary, navy darks, pastel section icons.
// ---------------------------------------------------------------------------
const BLUE = "0057FF";
const BLUE_300 = "3D8BFF";
const NAVY = "060810";
const DARK_BG = "05060C";
const INK = "0B0F1A";
const MUTED = "6B7280";
const GREEN = "0C9D57";
const PURPLE = "7C3AED";
const AMBER = "D97706";
const PINK = "D6336C";
const CYAN = "0891B2";
const LINE = "E2E7F5";
const CARD_BG = "F5F8FF";
const CARD_SOFT = "FAFBFF";
const WHITE = "FFFFFF";
const COVER_TEXT_SOFT = "B9C4E0";
const COVER_TEXT_MUTED = "8791AE";

const FONT = "Calibri";

/** 16:9 deck in inches. */
const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN_X = 0.58;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const TIER_FILL: Record<string, string> = {
  celebrity: AMBER,
  mega: "EA580C",
  macro: BLUE,
  "mid-tier": PINK,
  mid: PINK,
  micro: PURPLE,
  nano: GREEN,
};

/** Timeline dot colors, positional — matches the reference activation slide. */
const WAVE_DOT_COLORS = [AMBER, BLUE, PURPLE, CYAN, GREEN, PINK];

const CONTACT_LINE =
  "Thinkway · 44B Saraya Mall, Sheikh Zayed, Giza, Egypt · hello@thinkwaymedia.com";

function tierFill(tier?: string): string {
  const key = (tier ?? "").trim().toLowerCase();
  for (const [prefix, fill] of Object.entries(TIER_FILL)) {
    if (key.startsWith(prefix)) return fill;
  }
  return "94A3B8";
}

type PptxGen = InstanceType<typeof import("pptxgenjs").default>;
type Slide = ReturnType<PptxGen["addSlide"]>;

// ---------------------------------------------------------------------------
// Vector logo mark — rounded square with two dots (no image assets needed).
// ---------------------------------------------------------------------------
function addLogoMark(
  slide: Slide,
  x: number,
  y: number,
  size: number,
  theme: "dark" | "light"
): void {
  const squareFill = theme === "dark" ? WHITE : NAVY;
  const topDot = theme === "dark" ? NAVY : WHITE;
  slide.addShape("roundRect", {
    x,
    y,
    w: size,
    h: size,
    fill: { color: squareFill },
    line: { type: "none" },
    rectRadius: size * 0.28,
  });
  slide.addShape("ellipse", {
    x: x + size * 0.2,
    y: y + size * 0.2,
    w: size * 0.26,
    h: size * 0.26,
    fill: { color: topDot },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: x + size * 0.52,
    y: y + size * 0.52,
    w: size * 0.34,
    h: size * 0.34,
    fill: { color: BLUE },
    line: { type: "none" },
  });
}

function addLogoLockup(
  slide: Slide,
  x: number,
  y: number,
  markSize: number,
  fontSize: number,
  theme: "dark" | "light"
): void {
  addLogoMark(slide, x, y, markSize, theme);
  slide.addText(
    [
      { text: "THINK", options: { color: theme === "dark" ? WHITE : NAVY } },
      { text: "WAY", options: { color: theme === "dark" ? BLUE_300 : BLUE } },
    ],
    {
      x: x + markSize + 0.12,
      y: y - markSize * 0.18,
      w: 2.6,
      h: markSize * 1.4,
      fontFace: FONT,
      fontSize,
      bold: true,
      charSpacing: 1,
      valign: "middle",
    }
  );
}

/** Soft radial-glow approximation on dark slides (blue + purple ellipses). */
function addDarkGlow(slide: Slide): void {
  slide.background = { color: DARK_BG };
  slide.addShape("ellipse", {
    x: PAGE_W - 6.4,
    y: -3.6,
    w: 9.5,
    h: 7.2,
    fill: { color: PURPLE, transparency: 82 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: -4.2,
    y: PAGE_H - 3.6,
    w: 9.5,
    h: 7.2,
    fill: { color: BLUE, transparency: 82 },
    line: { type: "none" },
  });
}

// ---------------------------------------------------------------------------
// Shared content-slide chrome: brand header, section eyebrow, footer.
// ---------------------------------------------------------------------------
function addPageHeader(slide: Slide, sectionNumber: number, client: string): void {
  addLogoMark(slide, MARGIN_X, 0.3, 0.34, "light");
  slide.addText("THINKWAY  ·  CAMPAIGN INTELLIGENCE", {
    x: MARGIN_X + 0.46,
    y: 0.3,
    w: 5.5,
    h: 0.34,
    fontFace: FONT,
    fontSize: 9.5,
    bold: true,
    color: MUTED,
    charSpacing: 2,
    valign: "middle",
  });
  slide.addText(`${String(sectionNumber).padStart(2, "0")} / ${client}`, {
    x: PAGE_W - MARGIN_X - 3,
    y: 0.3,
    w: 3,
    h: 0.34,
    align: "right",
    fontFace: FONT,
    fontSize: 9.5,
    bold: true,
    color: MUTED,
    charSpacing: 1.5,
    valign: "middle",
  });
}

function addSectionEyebrow(slide: Slide, title: string, pastel: string): void {
  slide.addShape("roundRect", {
    x: MARGIN_X,
    y: 0.88,
    w: 0.44,
    h: 0.44,
    fill: { color: pastel },
    line: { type: "none" },
    rectRadius: 0.12,
  });
  slide.addText(title, {
    x: MARGIN_X + 0.62,
    y: 0.82,
    w: CONTENT_W - 0.62,
    h: 0.56,
    fontFace: FONT,
    fontSize: 23,
    bold: true,
    color: INK,
    valign: "middle",
  });
}

function addPageFooter(slide: Slide, pageNumber: number, client: string): void {
  const y = PAGE_H - 0.42;
  slide.addText("Thinkway · Campaign Intelligence Proposal", {
    x: MARGIN_X,
    y,
    w: 4.5,
    h: 0.3,
    fontFace: FONT,
    fontSize: 8,
    color: "9AA3B2",
  });
  slide.addText(`${client} · Confidential`, {
    x: PAGE_W / 2 - 2.25,
    y,
    w: 4.5,
    h: 0.3,
    align: "center",
    fontFace: FONT,
    fontSize: 8,
    bold: true,
    color: MUTED,
  });
  slide.addText(String(pageNumber).padStart(2, "0"), {
    x: PAGE_W - MARGIN_X - 1,
    y,
    w: 1,
    h: 0.3,
    align: "right",
    fontFace: FONT,
    fontSize: 8,
    color: "9AA3B2",
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * pptxgenjs `data` expects `mime;base64,...` (no `data:` prefix).
 * Fetches remote avatar URLs so CDN hotlink rules don't break deck write.
 */
async function resolvePptxImageData(url?: string | null): Promise<string | null> {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) {
    const payload = trimmed.slice("data:".length);
    return payload.includes(";base64,") ? payload : null;
  }
  const buffer = await fetchImageBuffer(trimmed);
  if (!buffer?.length) return null;
  const contentType = detectImageContentType(buffer);
  return `${contentType};base64,${buffer.toString("base64")}`;
}

async function resolveVendorAvatarData(
  vendors: ProposalVendor[]
): Promise<Map<string, string>> {
  const uniqueUrls = [
    ...new Set(
      vendors
        .map((v) => v.avatarUrl?.trim())
        .filter((url): url is string => Boolean(url))
    ),
  ];
  const entries = await Promise.all(
    uniqueUrls.map(async (url) => {
      const data = await resolvePptxImageData(url);
      return data ? ([url, data] as const) : null;
    })
  );
  return new Map(entries.filter((e): e is readonly [string, string] => e != null));
}

const CREATOR_AVATAR_SIZE = 0.34;
const CREATOR_TABLE_Y = 1.62;
const CREATOR_ROW_H = 0.56;
/** Creator col widths — avatar + name need extra room vs name-only. */
const CREATOR_COL_W = [2.45, 1.1, 1.1, 1.1, 0.8, 5.623] as const;

function formatFollowers(followers?: number): string {
  if (followers == null) return "—";
  if (followers >= 1_000_000) return `${(followers / 1_000_000).toFixed(1)}M`;
  if (followers >= 1_000) return `${Math.round(followers / 1_000)}K`;
  return String(followers);
}

function addCreatorAvatar(
  slide: Slide,
  vendor: ProposalVendor,
  avatarData: string | undefined,
  x: number,
  y: number
): void {
  const size = CREATOR_AVATAR_SIZE;
  if (avatarData) {
    slide.addImage({
      data: avatarData,
      x,
      y,
      w: size,
      h: size,
      rounding: true,
    });
    return;
  }
  const initial = (vendor.displayName.trim()[0] ?? "?").toUpperCase();
  slide.addShape("ellipse", {
    x,
    y,
    w: size,
    h: size,
    fill: { color: BLUE },
    line: { type: "none" },
  });
  slide.addText(initial, {
    x,
    y,
    w: size,
    h: size,
    align: "center",
    valign: "middle",
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: WHITE,
  });
}

/** Build the client proposal as a PowerPoint deck matching the reference design. */
export async function buildCampaignProposalPptxBuffer(
  campaignObject: CampaignObject,
  hydratedVendors: ProposalVendor[] = [],
  branding: ProposalBranding = {}
): Promise<Buffer> {
  const model: CampaignProposalModel = buildCampaignProposalModel(
    campaignObject,
    hydratedVendors,
    branding
  );
  const client = model.client;

  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: PAGE_W, height: PAGE_H });
  pptx.layout = "WIDE";
  pptx.author = "Thinkway Platform";
  pptx.company = "Thinkway";
  pptx.title = `${client} — Campaign Intelligence Proposal`;

  let pageNumber = 1;
  let sectionNumber = 0;

  // ================= COVER =================
  const cover = pptx.addSlide();
  addDarkGlow(cover);
  addLogoLockup(cover, MARGIN_X, 0.52, 0.5, 20, "dark");
  cover.addShape("roundRect", {
    x: PAGE_W - MARGIN_X - 3.1,
    y: 0.55,
    w: 3.1,
    h: 0.44,
    fill: { color: "10131F" },
    line: { color: "2A3350", width: 1 },
    rectRadius: 0.22,
  });
  cover.addText("CAMPAIGN INTELLIGENCE PROPOSAL", {
    x: PAGE_W - MARGIN_X - 3.1,
    y: 0.55,
    w: 3.1,
    h: 0.44,
    align: "center",
    fontFace: FONT,
    fontSize: 8.5,
    bold: true,
    color: "C9D8FF",
    charSpacing: 2,
    valign: "middle",
  });
  const clientNameSize = client.length <= 8 ? 72 : client.length <= 16 ? 52 : 36;
  cover.addText(client, {
    x: MARGIN_X,
    y: 2.55,
    w: CONTENT_W,
    h: 1.6,
    fontFace: FONT,
    fontSize: clientNameSize,
    bold: true,
    color: WHITE,
  });
  cover.addText(model.objective ?? model.campaignName, {
    x: MARGIN_X,
    y: 4.25,
    w: 8.6,
    h: 1.1,
    fontFace: FONT,
    fontSize: 14.5,
    color: COVER_TEXT_SOFT,
    lineSpacingMultiple: 1.25,
    valign: "top",
  });
  const coverMeta: Array<[string, string]> = [
    ["PREPARED FOR", `${client} · ${model.generated}`],
    ["STATUS", "Confidential — client review only"],
    ["DOCUMENT REF", model.presentationVersion],
  ];
  coverMeta.forEach(([label, value], i) => {
    const x = MARGIN_X + i * 3.1;
    cover.addText(label, {
      x,
      y: 6.15,
      w: 3,
      h: 0.28,
      fontFace: FONT,
      fontSize: 8.5,
      bold: true,
      color: COVER_TEXT_MUTED,
      charSpacing: 1.5,
    });
    cover.addText(value, {
      x,
      y: 6.42,
      w: 3,
      h: 0.32,
      fontFace: FONT,
      fontSize: 10.5,
      bold: true,
      color: WHITE,
    });
  });

  // ================= CAMPAIGN UNDERSTANDING =================
  sectionNumber += 1;
  pageNumber += 1;
  const understanding = pptx.addSlide();
  understanding.background = { color: WHITE };
  addPageHeader(understanding, sectionNumber, client);
  addSectionEyebrow(understanding, "Campaign Understanding", "DDEBFF");

  const tiles = model.statTiles.slice(0, 4);
  if (tiles.length > 0) {
    const gap = 0.2;
    const tileW = (CONTENT_W - gap * (tiles.length - 1)) / tiles.length;
    tiles.forEach((tile, i) => {
      const x = MARGIN_X + i * (tileW + gap);
      understanding.addShape("roundRect", {
        x,
        y: 1.62,
        w: tileW,
        h: 1.22,
        fill: { color: CARD_BG },
        line: { color: LINE, width: 1 },
        rectRadius: 0.1,
      });
      understanding.addShape("rect", {
        x: x + 0.06,
        y: 1.62,
        w: tileW - 0.12,
        h: 0.05,
        fill: { color: BLUE },
        line: { type: "none" },
      });
      understanding.addText(tile.label.toUpperCase(), {
        x: x + 0.2,
        y: 1.78,
        w: tileW - 0.4,
        h: 0.26,
        fontFace: FONT,
        fontSize: 8.5,
        bold: true,
        color: MUTED,
        charSpacing: 1.5,
      });
      understanding.addText(tile.value, {
        x: x + 0.2,
        y: 2.02,
        w: tileW - 0.4,
        h: 0.5,
        fontFace: FONT,
        fontSize: 20,
        bold: true,
        color: INK,
      });
      understanding.addText(tile.sub, {
        x: x + 0.2,
        y: 2.5,
        w: tileW - 0.4,
        h: 0.26,
        fontFace: FONT,
        fontSize: 8.5,
        color: MUTED,
      });
    });
  }

  const details = model.understanding.slice(0, 8);
  const colW = (CONTENT_W - 0.6) / 2;
  const detailTop = tiles.length > 0 ? 3.2 : 1.7;
  const rowH = 0.78;
  details.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN_X + col * (colW + 0.6);
    const y = detailTop + row * rowH;
    understanding.addText(label.toUpperCase(), {
      x,
      y,
      w: colW,
      h: 0.24,
      fontFace: FONT,
      fontSize: 8,
      bold: true,
      color: MUTED,
      charSpacing: 1.2,
    });
    understanding.addText(value, {
      x,
      y: y + 0.22,
      w: colW,
      h: rowH - 0.32,
      fontFace: FONT,
      fontSize: 10.5,
      bold: true,
      color: INK,
      valign: "top",
      shrinkText: true,
    });
    understanding.addShape("line", {
      x,
      y: y + rowH - 0.08,
      w: colW,
      h: 0,
      line: { color: LINE, width: 0.75 },
    });
  });
  addPageFooter(understanding, pageNumber, client);

  // ================= EXECUTIVE SUMMARY =================
  sectionNumber += 1;
  pageNumber += 1;
  const summary = pptx.addSlide();
  summary.background = { color: WHITE };
  addPageHeader(summary, sectionNumber, client);
  addSectionEyebrow(summary, "Executive Summary", "FFE0EC");

  summary.addText(model.executiveSummary, {
    x: MARGIN_X,
    y: 1.62,
    w: CONTENT_W,
    h: 1.15,
    fontFace: FONT,
    fontSize: 12.5,
    color: "374151",
    lineSpacingMultiple: 1.3,
    valign: "top",
    shrinkText: true,
  });

  const checks = model.recommendedActions.slice(0, 6);
  const checkTop = 2.95;
  const checkColW = (CONTENT_W - 0.24) / 2;
  const checkRowH = 0.72;
  checks.forEach((action, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN_X + col * (checkColW + 0.24);
    const y = checkTop + row * checkRowH;
    summary.addShape("roundRect", {
      x,
      y,
      w: checkColW,
      h: checkRowH - 0.14,
      fill: { color: CARD_SOFT },
      line: { color: LINE, width: 1 },
      rectRadius: 0.09,
    });
    summary.addShape("roundRect", {
      x: x + 0.16,
      y: y + (checkRowH - 0.14) / 2 - 0.11,
      w: 0.22,
      h: 0.22,
      fill: { color: "DDEBFF" },
      line: { type: "none" },
      rectRadius: 0.06,
    });
    summary.addText("✓", {
      x: x + 0.16,
      y: y + (checkRowH - 0.14) / 2 - 0.13,
      w: 0.22,
      h: 0.26,
      align: "center",
      fontFace: FONT,
      fontSize: 9,
      bold: true,
      color: BLUE,
      valign: "middle",
    });
    summary.addText(action, {
      x: x + 0.5,
      y,
      w: checkColW - 0.66,
      h: checkRowH - 0.14,
      fontFace: FONT,
      fontSize: 10,
      color: INK,
      valign: "middle",
      shrinkText: true,
    });
  });

  const strategyTags = buildProposalStrategyTags(model.mixSource).slice(0, 2);
  if (strategyTags.length > 0) {
    const tagTop = checkTop + Math.ceil(Math.max(checks.length, 1) / 2) * checkRowH + 0.16;
    const tagW = (CONTENT_W - 0.24 * (strategyTags.length - 1)) / strategyTags.length;
    strategyTags.forEach((tag, i) => {
      const x = MARGIN_X + i * (tagW + 0.24);
      summary.addShape("roundRect", {
        x,
        y: tagTop,
        w: tagW,
        h: 1.0,
        fill: { color: INK },
        line: { type: "none" },
        rectRadius: 0.12,
      });
      summary.addText(tag.n, {
        x,
        y: tagTop + 0.18,
        w: tagW,
        h: 0.42,
        align: "center",
        fontFace: FONT,
        fontSize: 16,
        bold: true,
        color: WHITE,
        shrinkText: true,
      });
      summary.addText(tag.l, {
        x,
        y: tagTop + 0.58,
        w: tagW,
        h: 0.3,
        align: "center",
        fontFace: FONT,
        fontSize: 9.5,
        color: "9AA6C7",
      });
    });
  }
  addPageFooter(summary, pageNumber, client);

  // ================= ACTIVATION PLAN =================
  if (model.waves.length > 0) {
    sectionNumber += 1;
    pageNumber += 1;
    const waves = pptx.addSlide();
    waves.background = { color: WHITE };
    addPageHeader(waves, sectionNumber, client);
    addSectionEyebrow(waves, "Activation Plan — Momentum Waves", "DDF7E8");
    waves.addText(
      "Staggered creator waves keep the campaign trending instead of peaking on day one.",
      {
        x: MARGIN_X,
        y: 1.5,
        w: CONTENT_W,
        h: 0.3,
        fontFace: FONT,
        fontSize: 10.5,
        color: MUTED,
      }
    );

    const items = model.waves.slice(0, 6);
    const itemTop = 2.05;
    const itemH = Math.min(0.86, 4.6 / items.length);
    const dotX = MARGIN_X + 0.35;
    if (items.length > 1) {
      waves.addShape("line", {
        x: dotX + 0.19,
        y: itemTop + 0.19,
        w: 0,
        h: itemH * (items.length - 1),
        line: { color: LINE, width: 1.5 },
      });
    }
    items.forEach((wave, i) => {
      const y = itemTop + i * itemH;
      const color = WAVE_DOT_COLORS[i % WAVE_DOT_COLORS.length]!;
      waves.addShape("ellipse", {
        x: dotX,
        y,
        w: 0.38,
        h: 0.38,
        fill: { color },
        line: { color: WHITE, width: 2 },
      });
      waves.addText(String(i + 1), {
        x: dotX,
        y: y - 0.02,
        w: 0.38,
        h: 0.42,
        align: "center",
        fontFace: FONT,
        fontSize: 11,
        bold: true,
        color: WHITE,
        valign: "middle",
      });
      waves.addText(`${wave.window} — ${wave.wave}`, {
        x: dotX + 0.58,
        y: y - 0.04,
        w: CONTENT_W - 1.1,
        h: 0.3,
        fontFace: FONT,
        fontSize: 12,
        bold: true,
        color: INK,
      });
      waves.addText(wave.goal, {
        x: dotX + 0.58,
        y: y + 0.24,
        w: CONTENT_W - 1.1,
        h: 0.3,
        fontFace: FONT,
        fontSize: 9.5,
        color: MUTED,
        shrinkText: true,
      });
    });
    addPageFooter(waves, pageNumber, client);
  }

  // ================= CREATORS =================
  if (model.vendors.length > 0) {
    sectionNumber += 1;
    const avatarDataByUrl = await resolveVendorAvatarData(model.vendors);
    const vendorPages = chunk(model.vendors, 8);
    vendorPages.forEach((slideVendors, pageIndex) => {
      pageNumber += 1;
      const creators = pptx.addSlide();
      creators.background = { color: WHITE };
      addPageHeader(creators, sectionNumber, client);
      addSectionEyebrow(
        creators,
        vendorPages.length > 1
          ? `Recommended Creators & Content Concepts (${pageIndex + 1}/${vendorPages.length})`
          : "Recommended Creators & Content Concepts",
        "DDEBFF"
      );

      const header = ["Creator", "Tier", "Platform", "Followers", "ER", "Content Concept"].map(
        (t) => ({
          text: t,
          options: { bold: true, color: MUTED, fontSize: 8.5, fill: { color: WHITE } },
        })
      );
      const rows = slideVendors.map((v) => [
        {
          text: v.displayName,
          options: {
            bold: true,
            color: INK,
            fontSize: 10,
            // Leave left inset for the circular avatar overlay.
            margin: [0.05, 0.06, 0.05, 0.48] as [number, number, number, number],
          },
        },
        { text: v.tier ?? "—", options: { color: tierFill(v.tier), bold: true, fontSize: 9.5 } },
        { text: v.platform ?? "—", options: { color: INK, fontSize: 9.5 } },
        {
          text: formatFollowers(v.followers),
          options: { color: INK, fontSize: 9.5 },
        },
        {
          text: v.engagementRate != null ? `${v.engagementRate.toFixed(1)}%` : "—",
          options: { color: INK, fontSize: 9.5 },
        },
        { text: v.contentIdea ?? v.reason ?? "", options: { color: "4B5563", fontSize: 9 } },
      ]);
      creators.addTable([header, ...rows] as never, {
        x: MARGIN_X,
        y: CREATOR_TABLE_Y,
        w: CONTENT_W,
        colW: [...CREATOR_COL_W],
        fontFace: FONT,
        border: { type: "solid", color: LINE, pt: 0.5 },
        autoPage: false,
        valign: "middle",
        rowH: CREATOR_ROW_H,
      });

      // Overlay circular avatars in the Creator column (tables cannot embed images).
      slideVendors.forEach((v, i) => {
        const rowTop = CREATOR_TABLE_Y + CREATOR_ROW_H * (i + 1);
        const avatarX = MARGIN_X + 0.1;
        const avatarY = rowTop + (CREATOR_ROW_H - CREATOR_AVATAR_SIZE) / 2;
        const url = v.avatarUrl?.trim();
        addCreatorAvatar(
          creators,
          v,
          url ? avatarDataByUrl.get(url) : undefined,
          avatarX,
          avatarY
        );
      });

      addPageFooter(creators, pageNumber, client);
    });
  }

  // ================= BUDGET & AMPLIFICATION =================
  sectionNumber += 1;
  pageNumber += 1;
  const budget = pptx.addSlide();
  budget.background = { color: WHITE };
  addPageHeader(budget, sectionNumber, client);
  addSectionEyebrow(budget, "Budget & Amplification", "FFE9CC");

  if (model.budget) {
    const primary = model.budget.allocations[0];
    const totalText =
      model.budget.total != null
        ? `${model.budget.currency} ${model.budget.total.toLocaleString()}`
        : "To be confirmed";
    budget.addShape("roundRect", {
      x: MARGIN_X,
      y: 1.6,
      w: CONTENT_W,
      h: 1.5,
      fill: { color: BLUE },
      line: { type: "none" },
      rectRadius: 0.14,
    });
    budget.addText(`${primary?.percent ?? 100}%`, {
      x: MARGIN_X + 0.45,
      y: 1.74,
      w: 3.4,
      h: 0.85,
      fontFace: FONT,
      fontSize: 40,
      bold: true,
      color: WHITE,
    });
    budget.addText(`${primary?.category ?? "Creator fees"} — ${totalText}`, {
      x: MARGIN_X + 0.45,
      y: 2.6,
      w: 5.4,
      h: 0.34,
      fontFace: FONT,
      fontSize: 11,
      color: "D6E4FF",
    });
    budget.addText(
      primary?.notes ??
        "Influencer campaign model — production embedded in creator fees unless explicitly separated",
      {
        x: PAGE_W - MARGIN_X - 5.4,
        y: 1.85,
        w: 5,
        h: 1.0,
        align: "right",
        fontFace: FONT,
        fontSize: 11,
        bold: true,
        color: WHITE,
        lineSpacingMultiple: 1.3,
        valign: "middle",
        shrinkText: true,
      }
    );
  }

  const ampItems = model.amplification.slice(0, 6);
  const ampTop = model.budget ? 3.42 : 1.7;
  const ampColW = (CONTENT_W - 0.24) / 2;
  const ampRowH = 0.82;
  ampItems.forEach(([, item], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN_X + col * (ampColW + 0.24);
    const y = ampTop + row * ampRowH;
    budget.addShape("roundRect", {
      x,
      y,
      w: ampColW,
      h: ampRowH - 0.16,
      fill: { color: CARD_SOFT },
      line: { color: LINE, width: 1 },
      rectRadius: 0.09,
    });
    budget.addShape("ellipse", {
      x: x + 0.16,
      y: y + (ampRowH - 0.16) / 2 - 0.12,
      w: 0.24,
      h: 0.24,
      fill: { color: "DDEBFF" },
      line: { type: "none" },
    });
    budget.addText(String(i + 1), {
      x: x + 0.16,
      y: y + (ampRowH - 0.16) / 2 - 0.14,
      w: 0.24,
      h: 0.28,
      align: "center",
      fontFace: FONT,
      fontSize: 8.5,
      bold: true,
      color: BLUE,
      valign: "middle",
    });
    budget.addText(item, {
      x: x + 0.52,
      y,
      w: ampColW - 0.68,
      h: ampRowH - 0.16,
      fontFace: FONT,
      fontSize: 9.5,
      color: INK,
      valign: "middle",
      shrinkText: true,
    });
  });
  addPageFooter(budget, pageNumber, client);

  // ================= SUCCESS METRICS =================
  if (model.kpis.length > 0) {
    sectionNumber += 1;
    pageNumber += 1;
    const metrics = pptx.addSlide();
    metrics.background = { color: WHITE };
    addPageHeader(metrics, sectionNumber, client);
    addSectionEyebrow(metrics, "Success Metrics", "DDF7E8");

    const kpiHeader = ["Metric", "Target", "Basis"].map((t) => ({
      text: t,
      options: { bold: true, color: MUTED, fontSize: 9, fill: { color: WHITE } },
    }));
    const kpiRows = model.kpis.slice(0, 6).map((k) => [
      { text: k.metric, options: { bold: true, color: INK, fontSize: 11 } },
      { text: k.target, options: { color: INK, fontSize: 11 } },
      { text: k.basis, options: { color: "4B5563", fontSize: 10 } },
    ]);
    metrics.addTable([kpiHeader, ...kpiRows] as never, {
      x: MARGIN_X,
      y: 1.62,
      w: CONTENT_W,
      colW: [2.6, 2.6, 6.97],
      fontFace: FONT,
      border: { type: "solid", color: LINE, pt: 0.5 },
      autoPage: false,
      valign: "middle",
      rowH: 0.6,
    });
    addPageFooter(metrics, pageNumber, client);
  }

  // ================= CLOSE =================
  const close = pptx.addSlide();
  addDarkGlow(close);
  addLogoLockup(close, PAGE_W / 2 - 1.05, 1.1, 0.5, 20, "dark");
  close.addText(buildProposalCloseHeadline(model), {
    x: PAGE_W / 2 - 4.6,
    y: 2.3,
    w: 9.2,
    h: 1.5,
    align: "center",
    fontFace: FONT,
    fontSize: 27,
    bold: true,
    color: WHITE,
    lineSpacingMultiple: 1.2,
    valign: "middle",
  });
  close.addText(
    `Prepared by the Thinkway Campaign Intelligence team · ${model.generated}`,
    {
      x: PAGE_W / 2 - 4,
      y: 3.95,
      w: 8,
      h: 0.32,
      align: "center",
      fontFace: FONT,
      fontSize: 10.5,
      color: "98A3C4",
    }
  );
  close.addText(CONTACT_LINE, {
    x: PAGE_W / 2 - 4.5,
    y: PAGE_H - 0.65,
    w: 9,
    h: 0.3,
    align: "center",
    fontFace: FONT,
    fontSize: 9,
    color: "7885A8",
  });

  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return output;
}
