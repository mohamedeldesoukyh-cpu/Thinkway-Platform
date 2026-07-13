import {
  detectImageContentType,
  fetchImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";

import type { ShortlistDocument } from "./shortlist-document";

const BLUE = "0057FF";
const NAVY = "060810";
const INK = "0B0F1A";
const MUTED = "6B7280";
const LAVENDER = "E8EFFE";
const CARD_BG = "F5F8FF";
const WHITE = "FFFFFF";
const COVER_TEXT_SOFT = "B9C4E0";

const FONT = "Calibri";
const PAGE_W = 13.333;
const PAGE_H = 7.5;
const MARGIN_X = 0.58;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const TIER_FILL: Record<string, string> = {
  celebrity: "D97706",
  mega: "EA580C",
  macro: BLUE,
  mid: "7C3AED",
  micro: "0C9D57",
  nano: "0891B2",
};

type PptxGen = InstanceType<typeof import("pptxgenjs").default>;
type Slide = ReturnType<PptxGen["addSlide"]>;

function tierFill(tier?: string): string {
  const key = (tier ?? "").trim().toLowerCase();
  for (const [prefix, fill] of Object.entries(TIER_FILL)) {
    if (key.startsWith(prefix)) return fill;
  }
  return "94A3B8";
}

function addLogoMark(slide: Slide, x: number, y: number, size: number): void {
  slide.addShape("roundRect", {
    x,
    y,
    w: size,
    h: size,
    fill: { color: WHITE },
    line: { type: "none" },
    rectRadius: size * 0.28,
  });
  slide.addShape("ellipse", {
    x: x + size * 0.2,
    y: y + size * 0.2,
    w: size * 0.26,
    h: size * 0.26,
    fill: { color: NAVY },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: x + size * 0.54,
    y: y + size * 0.54,
    w: size * 0.26,
    h: size * 0.26,
    fill: { color: BLUE },
    line: { type: "none" },
  });
}

async function avatarDataForPptx(
  avatarUrl: string | null
): Promise<string | null> {
  const trimmed = avatarUrl?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("data:")) return trimmed.replace(/^data:/, "");

  try {
    const result = await fetchImageBuffer(trimmed);
    if (!result.ok) return null;
    const contentType = result.contentType || detectImageContentType(result.buffer);
    return `${contentType};base64,${result.buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function addCoverSlide(pptx: PptxGen, doc: ShortlistDocument): void {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  addLogoMark(slide, MARGIN_X, 0.55, 0.42);

  slide.addText("Thinkway", {
    x: MARGIN_X + 0.55,
    y: 0.62,
    w: 2,
    h: 0.3,
    fontFace: FONT,
    fontSize: 14,
    bold: true,
    color: WHITE,
  });

  slide.addText("Discovery Shortlist · Showcase", {
    x: MARGIN_X,
    y: 1.35,
    w: CONTENT_W,
    h: 0.3,
    fontFace: FONT,
    fontSize: 11,
    color: COVER_TEXT_SOFT,
  });

  slide.addText(doc.name, {
    x: MARGIN_X,
    y: 1.85,
    w: CONTENT_W,
    h: 0.9,
    fontFace: FONT,
    fontSize: 30,
    bold: true,
    color: WHITE,
  });

  const entityLine = [doc.brandName, doc.clientName]
    .filter((value) => value && value !== "—")
    .join(" · ");

  slide.addText(entityLine || "Creator roster", {
    x: MARGIN_X,
    y: 2.75,
    w: CONTENT_W,
    h: 0.35,
    fontFace: FONT,
    fontSize: 14,
    color: COVER_TEXT_SOFT,
  });

  const metaRows = [
    `Shortlist ${doc.serial}`,
    `Status: ${doc.statusLabel}`,
    `Creators: ${doc.summary.creatorCount}`,
    `Reach: ${doc.summary.totalFollowersLabel}`,
    `Generated: ${doc.generatedDateLabel}`,
  ];

  slide.addText(metaRows.join("\n"), {
    x: MARGIN_X,
    y: 3.35,
    w: 5.5,
    h: 1.6,
    fontFace: FONT,
    fontSize: 12,
    color: COVER_TEXT_SOFT,
    lineSpacingMultiple: 1.2,
  });

  slide.addShape("rect", {
    x: MARGIN_X,
    y: 6.55,
    w: CONTENT_W,
    h: 0.01,
    fill: { color: "1A2238" },
    line: { type: "none" },
  });
  slide.addText("Confidential · Thinkway Platform", {
    x: MARGIN_X,
    y: 6.7,
    w: CONTENT_W,
    h: 0.25,
    fontFace: FONT,
    fontSize: 9,
    color: "8791AE",
  });
}

function addOverviewSlide(pptx: PptxGen, doc: ShortlistDocument): void {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  slide.addText("Roster overview", {
    x: MARGIN_X,
    y: 0.45,
    w: CONTENT_W,
    h: 0.45,
    fontFace: FONT,
    fontSize: 22,
    bold: true,
    color: INK,
  });

  const kpis = [
    ["Creators", String(doc.summary.creatorCount)],
    ["Total reach", doc.summary.totalFollowersLabel],
    ["Avg ER", doc.summary.avgEngagementRateLabel],
    ["Top platform", doc.summary.platformBreakdown[0]?.label ?? "—"],
    ["Top country", doc.summary.countryBreakdown[0]?.label ?? "—"],
    ["Top category", doc.summary.categoryBreakdown[0]?.label ?? "—"],
  ];

  const cardW = CONTENT_W / 3 - 0.12;
  kpis.forEach(([label, value], index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = MARGIN_X + col * (cardW + 0.18);
    const y = 1.2 + row * 1.35;
    slide.addShape("roundRect", {
      x,
      y,
      w: cardW,
      h: 1.05,
      fill: { color: CARD_BG },
      line: { color: LAVENDER, width: 1 },
      rectRadius: 0.08,
    });
    slide.addText(label, {
      x: x + 0.15,
      y: y + 0.12,
      w: cardW - 0.3,
      h: 0.2,
      fontFace: FONT,
      fontSize: 9,
      color: MUTED,
    });
    slide.addText(value, {
      x: x + 0.15,
      y: y + 0.38,
      w: cardW - 0.3,
      h: 0.45,
      fontFace: FONT,
      fontSize: 18,
      bold: true,
      color: INK,
    });
  });
}

async function addCreatorSlide(
  pptx: PptxGen,
  doc: ShortlistDocument,
  index: number
): Promise<void> {
  const group = doc.creatorGroups[index];
  if (!group) return;

  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  slide.addText(`Creator ${index + 1} of ${doc.creatorGroups.length}`, {
    x: MARGIN_X,
    y: 0.4,
    w: CONTENT_W,
    h: 0.25,
    fontFace: FONT,
    fontSize: 10,
    color: MUTED,
  });

  slide.addText(group.creator, {
    x: MARGIN_X,
    y: 0.7,
    w: 6.5,
    h: 0.55,
    fontFace: FONT,
    fontSize: 24,
    bold: true,
    color: INK,
  });

  if (group.handle !== "—") {
    slide.addText(group.handle, {
      x: MARGIN_X,
      y: 1.2,
      w: 6.5,
      h: 0.25,
      fontFace: FONT,
      fontSize: 12,
      color: MUTED,
    });
  }

  const avatarData = await avatarDataForPptx(group.avatarUrl);
  if (avatarData) {
    slide.addImage({
      data: avatarData,
      x: PAGE_W - MARGIN_X - 1.45,
      y: 0.55,
      w: 1.35,
      h: 1.35,
      sizing: { type: "cover", w: 1.35, h: 1.35 },
      rounding: true,
    });
  } else {
    slide.addShape("ellipse", {
      x: PAGE_W - MARGIN_X - 1.45,
      y: 0.55,
      w: 1.35,
      h: 1.35,
      fill: { color: LAVENDER },
      line: { type: "none" },
    });
  }

  const metrics = [
    ["Followers", group.followers],
    ["Engagement", group.engagementRate],
    ["Tier", group.tier],
    ["Market", group.country],
    ["Match", group.matchScore],
    ["Brand safety", group.brandSafety],
  ];

  const tableRows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
    metrics.map(([label]) => ({
      text: label,
      options: { bold: true, color: MUTED, fontSize: 9 },
    })),
    metrics.map(([, value]) => ({
      text: value,
      options: { bold: true, color: INK, fontSize: 12 },
    })),
  ];

  slide.addTable(tableRows, {
    x: MARGIN_X,
    y: 1.75,
    w: CONTENT_W,
    colW: [2.1, 2.1, 2.1, 2.1, 2.1, 2.1],
    border: { type: "solid", color: LAVENDER, pt: 1 },
    fill: { color: CARD_BG },
    fontFace: FONT,
  });

  slide.addShape("roundRect", {
    x: MARGIN_X,
    y: 2.95,
    w: 1.4,
    h: 0.35,
    fill: { color: tierFill(group.tier) },
    line: { type: "none" },
    rectRadius: 0.18,
  });
  slide.addText(group.tier, {
    x: MARGIN_X,
    y: 2.98,
    w: 1.4,
    h: 0.3,
    fontFace: FONT,
    fontSize: 10,
    bold: true,
    color: WHITE,
    align: "center",
  });

  const categories =
    group.categories.length > 0 ? group.categories.join(" · ") : group.interests;
  slide.addText(categories, {
    x: MARGIN_X + 1.6,
    y: 2.95,
    w: CONTENT_W - 1.6,
    h: 0.55,
    fontFace: FONT,
    fontSize: 11,
    color: INK,
  });

  slide.addText("Recent publications", {
    x: MARGIN_X,
    y: 3.75,
    w: CONTENT_W,
    h: 0.25,
    fontFace: FONT,
    fontSize: 10,
    bold: true,
    color: MUTED,
  });

  const shots = group.publicationShots.slice(0, 3);
  if (!shots.length) {
    slide.addText("No publication screenshots available.", {
      x: MARGIN_X,
      y: 4.1,
      w: CONTENT_W,
      h: 0.35,
      fontFace: FONT,
      fontSize: 11,
      color: MUTED,
      italic: true,
    });
    return;
  }

  const thumbW = (CONTENT_W - 0.3) / 3;
  for (let shotIndex = 0; shotIndex < shots.length; shotIndex++) {
    const shot = shots[shotIndex]!;
    const x = MARGIN_X + shotIndex * (thumbW + 0.15);
    const imageData = await avatarDataForPptx(
      shot.imageUrl.startsWith("data:") ? shot.imageUrl : shot.imageUrl || null
    );
    if (imageData) {
      slide.addImage({
        data: imageData,
        x,
        y: 4.05,
        w: thumbW,
        h: 2.2,
        sizing: { type: "cover", w: thumbW, h: 2.2 },
      });
    } else {
      slide.addShape("roundRect", {
        x,
        y: 4.05,
        w: thumbW,
        h: 2.2,
        fill: { color: LAVENDER },
        line: { color: BLUE, width: 1 },
        rectRadius: 0.08,
      });
    }
  }
}

function addRosterSlide(pptx: PptxGen, doc: ShortlistDocument): void {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  slide.addText(`Creator roster (${doc.summary.creatorCount})`, {
    x: MARGIN_X,
    y: 0.45,
    w: CONTENT_W,
    h: 0.45,
    fontFace: FONT,
    fontSize: 22,
    bold: true,
    color: INK,
  });

  const header = ["Creator", "Handle", "Followers", "ER", "Tier", "Match"];
  const rows = doc.creatorGroups.map((group) => [
    group.creator,
    group.handle,
    group.followers,
    group.engagementRate,
    group.tier,
    group.matchScore,
  ]);

  const tableData = [
    header.map((cell) => ({ text: cell, options: { bold: true, color: WHITE, fill: BLUE } })),
    ...rows.map((row, rowIndex) =>
      row.map((cell) => ({
        text: cell,
        options: {
          color: INK,
          fill: rowIndex % 2 === 0 ? WHITE : CARD_BG,
        },
      }))
    ),
  ];

  slide.addTable(tableData, {
    x: MARGIN_X,
    y: 1.15,
    w: CONTENT_W,
    fontFace: FONT,
    fontSize: 10,
    border: { type: "solid", color: LAVENDER, pt: 1 },
  });
}

function addClosingSlide(pptx: PptxGen, doc: ShortlistDocument): void {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  addLogoMark(slide, MARGIN_X, 2.2, 0.55);

  slide.addText("Thank you", {
    x: MARGIN_X,
    y: 3.0,
    w: CONTENT_W,
    h: 0.6,
    fontFace: FONT,
    fontSize: 28,
    bold: true,
    color: WHITE,
  });

  slide.addText(
    `This showcase shortlist (${doc.serial}) is confidential and intended for authorized stakeholders.\nAccount owner: ${doc.ownerName}`,
    {
      x: MARGIN_X,
      y: 3.75,
      w: CONTENT_W,
      h: 1.2,
      fontFace: FONT,
      fontSize: 12,
      color: COVER_TEXT_SOFT,
      lineSpacingMultiple: 1.25,
    }
  );
}

export async function buildShortlistPptxBuffer(doc: ShortlistDocument): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: PAGE_W, height: PAGE_H });
  pptx.layout = "WIDE";
  pptx.author = "Thinkway Platform";
  pptx.company = "Thinkway";
  pptx.title = `${doc.serial} — ${doc.name} — Shortlist Showcase`;

  addCoverSlide(pptx, doc);
  addOverviewSlide(pptx, doc);

  for (let index = 0; index < doc.creatorGroups.length; index++) {
    await addCreatorSlide(pptx, doc, index);
  }

  if (doc.creatorGroups.length > 0) {
    addRosterSlide(pptx, doc);
  }

  addClosingSlide(pptx, doc);

  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return output;
}
