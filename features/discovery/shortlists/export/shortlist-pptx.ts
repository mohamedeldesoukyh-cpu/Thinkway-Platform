import {
  TW_BLUE,
  TW_COVER_FOOTER,
  TW_COVER_KICKER,
  TW_COVER_META,
  TW_COVER_STAT_LABEL,
  TW_COVER_CHIP_TRANSPARENCY,
  TW_COVER_STAT_TRANSPARENCY,
  TW_CONTENT_BOTTOM,
  TW_CONTENT_W,
  TW_FOOTER_MUTED,
  TW_GLASS_CARD_TRANSPARENCY,
  TW_HAIR,
  TW_INSIGHT_BG,
  TW_LAV_LINE,
  TW_LAVENDER,
  TW_MARGIN_X,
  TW_MUTED,
  TW_MUTED_SOFT,
  TW_NAVY,
  TW_PAGE_W,
  TW_ROW_HAIR,
  TW_TITLE_INK,
  TW_WHITE,
  TW_FONT_BODY,
  TW_FONT_UI,
  TW_GAP_SM,
  TW_PUB_COLS,
  TW_PUB_THUMB_SIZE,
  addThinkwayBrandLockup,
  addThinkwayCreatorAvatar,
  addThinkwayPublicationThumbs,
  addThinkwaySectionHeader,
  addThinkwaySlideFooter,
  applyThinkwayClosingBackground,
  applyThinkwayContentBackground,
  applyThinkwayCoverBackground,
  configureThinkwayPptxLayout,
  nextThinkwaySlideNo,
  type ThinkwayPptxGen,
  type ThinkwaySlide,
  type ThinkwaySlideCounter,
} from "@/lib/export/thinkway-deck-pptx";
import { showcaseInitialsFromHandle } from "@/features/discovery/shortlists/templates/shortlist-template-format";

import type { ShortlistDocCreatorGroup, ShortlistDocument } from "./shortlist-document";
import { isPitchTemplate } from "./shortlist-template";

type ShortlistTierGroup = {
  name: string;
  creators: ShortlistDocCreatorGroup[];
  profileCount: number;
  followersLabel: string;
  avgErLabel: string;
};

function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

function buildTierGroups(doc: ShortlistDocument): ShortlistTierGroup[] {
  const byTier = new Map<string, ShortlistDocCreatorGroup[]>();
  for (const group of doc.creatorGroups) {
    const tier = group.tier?.trim() || "Other";
    const bucket = byTier.get(tier) ?? [];
    bucket.push(group);
    byTier.set(tier, bucket);
  }

  return [...byTier.entries()].map(([name, creators]) => {
    const followersTotal = creators.reduce(
      (sum, creator) => sum + (creator.followersNumeric ?? 0),
      0
    );
    const erValues = creators
      .map((creator) => creator.engagementRateNumeric)
      .filter((value): value is number => value != null && Number.isFinite(value));
    const avgEr =
      erValues.length > 0
        ? `${(erValues.reduce((sum, value) => sum + value, 0) / erValues.length).toFixed(2)}%`
        : "—";

    return {
      name,
      creators,
      profileCount: creators.length,
      followersLabel: formatCompactCount(followersTotal),
      avgErLabel: avgEr,
    };
  });
}

function coverDeckLabel(doc: ShortlistDocument): string {
  return isPitchTemplate(doc.template)
    ? "DISCOVERY SHORTLIST · PITCH PRESENTATION"
    : "DISCOVERY SHORTLIST · SHOWCASE";
}

function addCoverSlide(pptx: ThinkwayPptxGen, doc: ShortlistDocument, counter: ThinkwaySlideCounter): void {
  const slide = pptx.addSlide();
  applyThinkwayCoverBackground(slide);
  addThinkwayBrandLockup(slide, "light", 0.5, 0.45);

  const chipLabel = `${doc.serial} · ${doc.statusLabel}`.toUpperCase();
  const chipW = Math.min(2.8, 1.0 + chipLabel.length * 0.09);
  slide.addShape("roundRect", {
    x: TW_PAGE_W - TW_MARGIN_X - chipW,
    y: 0.52,
    w: chipW,
    h: 0.34,
    fill: { color: TW_WHITE, transparency: TW_COVER_CHIP_TRANSPARENCY },
    line: { color: TW_WHITE, width: 1 },
    rectRadius: 0.17,
  });
  slide.addText(chipLabel, {
    x: TW_PAGE_W - TW_MARGIN_X - chipW,
    y: 0.58,
    w: chipW,
    h: 0.22,
    fontFace: TW_FONT_UI,
    fontSize: 9,
    bold: true,
    color: TW_COVER_KICKER,
    align: "center",
    charSpacing: 1.2,
  });

  slide.addText(coverDeckLabel(doc), {
    x: TW_MARGIN_X,
    y: 1.85,
    w: 11,
    h: 0.3,
    fontFace: TW_FONT_UI,
    fontSize: 11,
    bold: true,
    color: TW_COVER_KICKER,
    charSpacing: 2.2,
  });

  slide.addText(doc.name, {
    x: 0.57,
    y: 2.2,
    w: 11.4,
    h: 1.5,
    fontFace: TW_FONT_UI,
    fontSize: 36,
    bold: true,
    color: TW_WHITE,
    valign: "top",
  });

  const entityLine = [doc.brandName, doc.clientName]
    .filter((value) => value && value !== "—")
    .join(" · ");
  slide.addText(
    entityLine
      ? `Creator roster prepared exclusively for ${entityLine}.`
      : "Creator roster prepared exclusively for authorized stakeholders.",
    {
      x: TW_MARGIN_X,
      y: 3.72,
      w: 9,
      h: 0.4,
      fontFace: TW_FONT_UI,
      fontSize: 13,
      color: TW_COVER_KICKER,
    }
  );

  const metaCells = [
    ["Shortlist No.", doc.serial],
    ["Client", doc.clientName],
    ["Brand", doc.brandName],
    ["Prepared By", doc.ownerName],
    ["Generated", doc.generatedDateLabel],
    ["Status", doc.statusLabel],
    ["Visibility", doc.visibilityLabel],
    ["Creators", String(doc.summary.creatorCount)],
  ];
  const metaCellW = 2.85;
  const metaGap = 0.18;
  metaCells.forEach(([label, value], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = TW_MARGIN_X + col * (metaCellW + metaGap);
    const y = 4.35 + row * 0.72;
    slide.addText(String(label).toUpperCase(), {
      x,
      y,
      w: metaCellW,
      h: 0.22,
      fontFace: TW_FONT_UI,
      fontSize: 9,
      color: TW_COVER_META,
      charSpacing: 1.2,
    });
    slide.addText(String(value), {
      x,
      y: y + 0.2,
      w: metaCellW,
      h: 0.3,
      fontFace: TW_FONT_UI,
      fontSize: 13,
      bold: true,
      color: TW_WHITE,
    });
  });

  const statW = 5.9;
  const statH = 1.12;
  const statY = 5.78;
  const stats = [
    {
      label: "Campaign Creators",
      value: String(doc.summary.creatorCount),
      sub: `${doc.summary.platformBreakdown.length} platform mix`,
    },
    {
      label: "Audience Size",
      value: doc.summary.totalFollowersLabel,
      sub: `Est. reach ${doc.summary.estimatedReachLabel}`,
    },
  ];
  stats.forEach((stat, index) => {
    const x = TW_MARGIN_X + index * (statW + 0.33);
    slide.addShape("roundRect", {
      x,
      y: statY,
      w: statW,
      h: statH,
      fill: { color: TW_WHITE, transparency: TW_COVER_STAT_TRANSPARENCY },
      line: { color: TW_WHITE, width: 1 },
      rectRadius: 0.12,
    });
    slide.addText(stat.label.toUpperCase(), {
      x: x + 0.28,
      y: statY + 0.15,
      w: statW - 0.5,
      h: 0.22,
      fontFace: TW_FONT_UI,
      fontSize: 10,
      color: TW_COVER_STAT_LABEL,
      charSpacing: 1.2,
    });
    slide.addText(stat.value, {
      x: x + 0.26,
      y: statY + 0.36,
      w: statW - 0.5,
      h: 0.5,
      fontFace: TW_FONT_UI,
      fontSize: 28,
      bold: true,
      color: TW_WHITE,
    });
    slide.addText(stat.sub, {
      x: x + 0.28,
      y: statY + 0.82,
      w: statW - 0.5,
      h: 0.24,
      fontFace: TW_FONT_UI,
      fontSize: 11,
      color: TW_COVER_KICKER,
    });
  });

  nextThinkwaySlideNo(counter);
  slide.addText(`Confidential · Thinkway Platform · ${doc.generatedDateLabel}`, {
    x: TW_MARGIN_X,
    y: 7.05,
    w: 7,
    h: 0.3,
    fontFace: TW_FONT_UI,
    fontSize: 9,
    color: TW_COVER_FOOTER,
  });
  slide.addText(`Generated ${doc.generatedDateLabel}`, {
    x: 8,
    y: 7.05,
    w: 4.73,
    h: 0.3,
    fontFace: TW_FONT_UI,
    fontSize: 9,
    color: TW_COVER_FOOTER,
    align: "right",
  });
}

function addCreatorMixSlide(
  pptx: ThinkwayPptxGen,
  doc: ShortlistDocument,
  counter: ThinkwaySlideCounter
): void {
  const slide = pptx.addSlide();
  applyThinkwayContentBackground(slide);
  const pageNo = nextThinkwaySlideNo(counter);

  let cursorY = addThinkwaySectionHeader(slide, "SECTION 01 · CREATOR MIX", "Creator mix");

  const categoryCards = doc.summary.categoryBreakdown.slice(0, 4);
  const catW = 2.92;
  const gap = 0.17;
  categoryCards.forEach((cat, index) => {
    const share =
      doc.summary.creatorCount > 0
        ? `${Math.round((cat.count / doc.summary.creatorCount) * 1000) / 10}%`
        : "0%";
    const x = TW_MARGIN_X + index * (catW + gap);
    slide.addShape("roundRect", {
      x,
      y: 2.0,
      w: catW,
      h: 1.0,
      fill: { color: TW_WHITE, transparency: TW_GLASS_CARD_TRANSPARENCY },
      line: { color: TW_HAIR, width: 1 },
      rectRadius: 0.1,
    });
    slide.addText(cat.label.toUpperCase(), {
      x: x + 0.2,
      y: 2.14,
      w: 2.52,
      h: 0.2,
      fontFace: TW_FONT_UI,
      fontSize: 10,
      bold: true,
      color: TW_MUTED_SOFT,
      charSpacing: 1,
    });
    slide.addText(String(cat.count), {
      x: x + 0.18,
      y: 2.34,
      w: 1.2,
      h: 0.42,
      fontFace: TW_FONT_UI,
      fontSize: 28,
      bold: true,
      color: TW_BLUE,
    });
    slide.addText(`${cat.count === 1 ? "creator" : "creators"} · ${share}`, {
      x: x + 0.2,
      y: 2.78,
      w: 2.52,
      h: 0.2,
      fontFace: TW_FONT_BODY,
      fontSize: 11,
      color: TW_MUTED,
    });
  });

  cursorY = 3.3;
  slide.addText("FULL INFLUENCER BREAKDOWN BY TIER", {
    x: TW_MARGIN_X,
    y: cursorY,
    w: 11,
    h: 0.24,
    fontFace: TW_FONT_UI,
    fontSize: 10,
    bold: true,
    color: TW_MUTED_SOFT,
    charSpacing: 1.2,
  });
  cursorY = 3.62;

  for (const tier of buildTierGroups(doc).slice(0, 2)) {
    const creators = tier.creators.slice(0, 8);
    const rowH = 0.24;
    const tableH = 0.26 + creators.length * rowH;

    const tagW = Math.min(1.15, 0.55 + tier.name.length * 0.07);
    slide.addShape("roundRect", {
      x: TW_MARGIN_X,
      y: cursorY,
      w: tagW,
      h: 0.26,
      fill: { color: TW_NAVY },
      line: { type: "none" },
      rectRadius: 0.05,
    });
    slide.addText(tier.name.toUpperCase(), {
      x: TW_MARGIN_X,
      y: cursorY,
      w: tagW,
      h: 0.26,
      fontFace: TW_FONT_UI,
      fontSize: 9,
      bold: true,
      color: TW_WHITE,
      align: "center",
      valign: "middle",
    });
    slide.addText(
      `${tier.profileCount} profile${tier.profileCount === 1 ? "" : "s"} · ${tier.followersLabel} followers · Avg ER ${tier.avgErLabel}`,
      {
        x: 1.9,
        y: cursorY,
        w: 10.4,
        h: 0.26,
        fontFace: TW_FONT_BODY,
        fontSize: 11,
        color: TW_MUTED,
        valign: "middle",
      }
    );

    const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
      [
        { text: "Handle", options: { bold: true, color: TW_MUTED, fontSize: 9, fill: { color: TW_WHITE } } },
        { text: "Platform", options: { bold: true, color: TW_MUTED, fontSize: 9, fill: { color: TW_WHITE } } },
        {
          text: "Followers",
          options: { bold: true, color: TW_MUTED, fontSize: 9, fill: { color: TW_WHITE }, align: "right" },
        },
        { text: "Category", options: { bold: true, color: TW_MUTED, fontSize: 9, fill: { color: TW_WHITE } } },
        {
          text: "ER %",
          options: { bold: true, color: TW_MUTED, fontSize: 9, fill: { color: TW_WHITE }, align: "right" },
        },
      ],
      ...creators.map((creator) => [
        { text: creator.handle.replace(/^@/, ""), options: { fontSize: 10, bold: true, color: TW_TITLE_INK } },
        { text: creator.platform, options: { fontSize: 10, color: TW_TITLE_INK } },
        { text: creator.followers, options: { fontSize: 10, color: TW_TITLE_INK, align: "right" } },
        {
          text: creator.categories[0] ?? creator.interests,
          options: { fontSize: 10, color: TW_TITLE_INK },
        },
        { text: creator.engagementRate, options: { fontSize: 10, color: TW_TITLE_INK, align: "right" } },
      ]),
    ];

    slide.addTable(rows, {
      x: TW_MARGIN_X,
      y: cursorY + 0.34,
      w: 12.13,
      colW: [2.6, 2.0, 1.8, 3.9, 1.83],
      border: { type: "solid", pt: 0.5, color: TW_ROW_HAIR },
      fontFace: TW_FONT_BODY,
      autoPage: false,
      rowH,
      h: tableH,
      align: "left",
      valign: "middle",
    });
    cursorY += 0.34 + tableH + 0.28;
  }

  const footerBlockY = Math.min(cursorY + 0.05, TW_CONTENT_BOTTOM - 1.5);
  slide.addShape("roundRect", {
    x: TW_MARGIN_X,
    y: footerBlockY,
    w: 12.13,
    h: 0.62,
    fill: { color: TW_WHITE },
    line: { color: TW_HAIR, width: 1 },
    rectRadius: 0.1,
  });
  slide.addText(`Grand total · ${doc.summary.creatorCount} influencers`, {
    x: 0.85,
    y: footerBlockY,
    w: 5,
    h: 0.62,
    fontFace: TW_FONT_UI,
    fontSize: 13,
    bold: true,
    color: TW_TITLE_INK,
    valign: "middle",
  });

  const totals = [
    ["FOLLOWERS", doc.summary.totalFollowersLabel],
    ["AVG ER", doc.summary.avgEngagementRateLabel],
    ["EST. REACH", doc.summary.estimatedReachLabel],
  ];
  totals.forEach(([label, value], index) => {
    const x = 6.2 + index * 2.05;
    slide.addText(label, {
      x,
      y: footerBlockY + 0.1,
      w: 1.85,
      h: 0.16,
      fontFace: TW_FONT_UI,
      fontSize: 8,
      color: TW_MUTED_SOFT,
      charSpacing: 0.8,
    });
    slide.addText(value, {
      x,
      y: footerBlockY + 0.28,
      w: 1.95,
      h: 0.28,
      fontFace: TW_FONT_UI,
      fontSize: 14,
      bold: true,
      color: TW_TITLE_INK,
    });
  });

  const insightParts = [
    `Category mix — ${doc.summary.categoryBreakdown.map((item) => `${item.label} ${item.count}`).join(" · ") || "—"}`,
    `Platform mix — ${doc.summary.platformBreakdown.map((item) => `${item.label} ${item.count}`).join(" · ") || "—"}`,
    `Scale — ${doc.summary.creatorCount} creators with average ER ${doc.summary.avgEngagementRateLabel}`,
  ].join("  ");
  const insightY = Math.min(footerBlockY + 0.78, TW_CONTENT_BOTTOM - 0.85);
  slide.addShape("roundRect", {
    x: TW_MARGIN_X,
    y: insightY,
    w: 12.13,
    h: 0.72,
    fill: { color: TW_INSIGHT_BG },
    line: { type: "none" },
    rectRadius: 0.1,
  });
  slide.addText("✦", {
    x: 0.82,
    y: insightY + 0.18,
    w: 0.34,
    h: 0.34,
    fontFace: TW_FONT_UI,
    fontSize: 11,
    color: TW_BLUE,
    align: "center",
    valign: "middle",
  });
  slide.addText(`Campaign mix insight.   ${insightParts}`, {
    x: 1.35,
    y: insightY,
    w: 11.1,
    h: 0.72,
    fontFace: TW_FONT_BODY,
    fontSize: 11,
    color: TW_TITLE_INK,
    valign: "middle",
  });

  addThinkwaySlideFooter(slide, `${doc.serial} · Creator mix`, pageNo);
}

async function addCreatorSlide(
  pptx: ThinkwayPptxGen,
  doc: ShortlistDocument,
  index: number,
  counter: ThinkwaySlideCounter
): Promise<void> {
  const group = doc.creatorGroups[index];
  if (!group) return;

  const pitch = isPitchTemplate(doc.template);
  const slide = pptx.addSlide();
  applyThinkwayContentBackground(slide);
  const pageNo = nextThinkwaySlideNo(counter);
  const initials = showcaseInitialsFromHandle(group.handle || group.creator);

  addThinkwayBrandLockup(slide, "dark", 0.42, 0.37);
  slide.addText(
    `SECTION 02 · CREATOR ${index + 1} OF ${doc.creatorGroups.length}`,
    {
      x: TW_MARGIN_X,
      y: 1.02,
      w: 11,
      h: 0.24,
      fontFace: TW_FONT_UI,
      fontSize: 10.5,
      bold: true,
      color: TW_BLUE,
      charSpacing: 1.6,
    }
  );

  const avatarSize = pitch ? 2.2 : 0.64;
  const avatarY = pitch ? 1.28 : 1.35;
  await addThinkwayCreatorAvatar(slide, {
    avatarUrl: group.avatarUrl,
    initials,
    x: TW_MARGIN_X,
    y: avatarY,
    size: avatarSize,
    pitch,
  });

  const nameX = TW_MARGIN_X + avatarSize + (pitch ? 0.32 : 0.14);
  slide.addText(group.creator, {
    x: nameX,
    y: pitch ? 1.35 : 1.35,
    w: 8,
    h: 0.36,
    fontFace: TW_FONT_UI,
    fontSize: pitch ? 24 : 22,
    bold: true,
    color: TW_TITLE_INK,
  });
  if (group.handle !== "—") {
    slide.addText(group.handle, {
      x: nameX,
      y: pitch ? 1.78 : 1.72,
      w: 8,
      h: 0.18,
      fontFace: TW_FONT_BODY,
      fontSize: pitch ? 12 : 11,
      color: TW_MUTED,
    });
  }

  const metrics = [
    ["Followers", group.followers],
    ["Engagement", group.engagementRate],
    ["Tier", group.tier],
    ["Market", group.country],
  ];
  const metricW = TW_CONTENT_W / 4 - 0.08;
  const metricY = pitch ? 3.55 : 2.15;
  metrics.forEach(([label, value], metricIndex) => {
    const x = TW_MARGIN_X + metricIndex * (metricW + TW_GAP_SM);
    slide.addShape("roundRect", {
      x,
      y: metricY,
      w: metricW,
      h: 0.64,
      fill: { color: TW_LAVENDER },
      line: { color: TW_LAV_LINE, width: 1 },
      rectRadius: 0.08,
    });
    slide.addText(label.toUpperCase(), {
      x: x + 0.08,
      y: metricY + 0.08,
      w: metricW - 0.16,
      h: 0.14,
      fontFace: TW_FONT_UI,
      fontSize: 8,
      color: TW_MUTED,
      charSpacing: 0.8,
    });
    slide.addText(value, {
      x: x + 0.08,
      y: metricY + 0.26,
      w: metricW - 0.16,
      h: 0.3,
      fontFace: TW_FONT_BODY,
      fontSize: 11,
      bold: true,
      color: TW_TITLE_INK,
    });
  });

  const categories =
    group.categories.length > 0 ? group.categories.join(" · ") : group.interests;
  slide.addText(categories, {
    x: TW_MARGIN_X,
    y: pitch ? 4.35 : 2.95,
    w: TW_CONTENT_W,
    h: 0.35,
    fontFace: TW_FONT_BODY,
    fontSize: 11,
    color: TW_TITLE_INK,
  });

  const pubsY = await addThinkwayPublicationThumbs(
    slide,
    group.publicationShots.map((shot) => ({
      imageUrl: shot.imageUrl,
      isVideo: shot.isVideo,
    })),
    pitch ? 4.78 : 3.35,
    "Recent publications",
    pitch ? 3 : TW_PUB_COLS,
    pitch ? 1.05 : TW_PUB_THUMB_SIZE
  );

  if (group.notes?.trim()) {
    slide.addText("NOTES", {
      x: TW_MARGIN_X,
      y: Math.min(pubsY + 0.05, TW_CONTENT_BOTTOM - 0.55),
      w: TW_CONTENT_W,
      h: 0.16,
      fontFace: TW_FONT_UI,
      fontSize: 9,
      bold: true,
      color: TW_BLUE,
      charSpacing: 1.2,
    });
    slide.addText(group.notes.trim(), {
      x: TW_MARGIN_X,
      y: Math.min(pubsY + 0.22, TW_CONTENT_BOTTOM - 0.38),
      w: TW_CONTENT_W,
      h: 0.34,
      fontFace: TW_FONT_BODY,
      fontSize: 10,
      color: TW_MUTED,
    });
  }

  addThinkwaySlideFooter(slide, `${doc.serial} · ${group.handle}`, pageNo);
}

function addRosterSlide(
  pptx: ThinkwayPptxGen,
  doc: ShortlistDocument,
  counter: ThinkwaySlideCounter
): void {
  const slide = pptx.addSlide();
  applyThinkwayContentBackground(slide);
  const pageNo = nextThinkwaySlideNo(counter);
  const cursorY = addThinkwaySectionHeader(slide, "SECTION 03 · CREATOR ROSTER", "At a glance");

  const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
    [
      { text: "Creator", options: { bold: true, color: TW_WHITE, fontSize: 9, fill: { color: TW_NAVY } } },
      { text: "Followers", options: { bold: true, color: TW_WHITE, fontSize: 9, fill: { color: TW_NAVY } } },
      { text: "ER", options: { bold: true, color: TW_WHITE, fontSize: 9, fill: { color: TW_NAVY } } },
      { text: "Tier", options: { bold: true, color: TW_WHITE, fontSize: 9, fill: { color: TW_NAVY } } },
      { text: "Categories", options: { bold: true, color: TW_WHITE, fontSize: 9, fill: { color: TW_NAVY } } },
      { text: "Platforms", options: { bold: true, color: TW_WHITE, fontSize: 9, fill: { color: TW_NAVY } } },
    ],
    ...doc.creatorGroups.map((group) => [
      { text: group.handle !== "—" ? group.handle : group.creator, options: { fontSize: 9, bold: true, color: TW_TITLE_INK } },
      { text: group.followers, options: { fontSize: 9, color: TW_TITLE_INK } },
      { text: group.engagementRate, options: { fontSize: 9, color: TW_TITLE_INK } },
      { text: group.tier, options: { fontSize: 9, color: TW_TITLE_INK } },
      {
        text: group.categories.length > 0 ? group.categories.join(", ") : group.interests,
        options: { fontSize: 9, color: TW_TITLE_INK },
      },
      { text: group.platform, options: { fontSize: 9, color: TW_TITLE_INK } },
    ]),
  ];

  slide.addTable(rows, {
    x: TW_MARGIN_X,
    y: cursorY + 0.1,
    w: TW_CONTENT_W,
    colW: [2.3, 1.5, 1.1, 1.2, 3.2, 2.83],
    border: { type: "solid", color: TW_HAIR, pt: 0.75 },
    fontFace: TW_FONT_BODY,
    autoPage: false,
    rowH: 0.28,
  });

  addThinkwaySlideFooter(slide, `${doc.serial} · Roster`, pageNo);
}

function addClosingSlide(
  pptx: ThinkwayPptxGen,
  doc: ShortlistDocument,
  counter: ThinkwaySlideCounter
): void {
  const slide = pptx.addSlide();
  applyThinkwayClosingBackground(slide);
  addThinkwayBrandLockup(slide, "light", 0.55, 0.5);
  nextThinkwaySlideNo(counter);

  slide.addText("Let's build something\nworth watching.", {
    x: 0.57,
    y: 2.5,
    w: 10.5,
    h: 1.7,
    fontFace: TW_FONT_UI,
    fontSize: 40,
    bold: true,
    color: TW_WHITE,
    valign: "top",
  });

  const entityLine = [doc.clientName, doc.brandName].filter((value) => value && value !== "—").join(" × ");
  slide.addText(
    entityLine
      ? `Thank you for reviewing this shortlist. We're ready to bring the ${entityLine} creator roster to life.`
      : `Thank you for reviewing this shortlist (${doc.serial}). We're ready to bring this creator roster to life.`,
    {
      x: TW_MARGIN_X,
      y: 4.25,
      w: 9.5,
      h: 0.5,
      fontFace: TW_FONT_UI,
      fontSize: 13,
      color: TW_COVER_KICKER,
    }
  );

  slide.addText(
    [
      { text: "EMAIL    ", options: { color: "7F93C4", bold: true } },
      { text: "hello@thinkwaymedia.com", options: { color: "7F93C4" } },
    ],
    { x: TW_MARGIN_X, y: 5.15, w: 5, h: 0.3, fontFace: TW_FONT_UI, fontSize: 12 }
  );
  slide.addText(
    [
      { text: "LOCATION    ", options: { color: "7F93C4", bold: true } },
      { text: "Sheikh Zayed, Giza", options: { color: "7F93C4" } },
    ],
    { x: 5.6, y: 5.15, w: 5, h: 0.3, fontFace: TW_FONT_UI, fontSize: 12 }
  );

  slide.addText("Thinkway (ثينكواي) · CR 57920 · VAT 780-879-732", {
    x: TW_MARGIN_X,
    y: 6.9,
    w: 11,
    h: 0.3,
    fontFace: TW_FONT_UI,
    fontSize: 11,
    color: "7F93C4",
  });
}

async function buildCreatorDeckPptx(pptx: ThinkwayPptxGen, doc: ShortlistDocument): Promise<void> {
  const counter: ThinkwaySlideCounter = { n: 0 };
  addCoverSlide(pptx, doc, counter);
  addCreatorMixSlide(pptx, doc, counter);

  for (let index = 0; index < doc.creatorGroups.length; index++) {
    await addCreatorSlide(pptx, doc, index, counter);
  }

  if (doc.creatorGroups.length > 0) {
    addRosterSlide(pptx, doc, counter);
  }

  addClosingSlide(pptx, doc, counter);
}

export async function buildShortlistPptxBuffer(doc: ShortlistDocument): Promise<Buffer> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  configureThinkwayPptxLayout(pptx);
  pptx.title = `${doc.serial} — ${doc.name} — Shortlist ${isPitchTemplate(doc.template) ? "Pitch" : "Showcase"}`;

  await buildCreatorDeckPptx(pptx, doc);

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
