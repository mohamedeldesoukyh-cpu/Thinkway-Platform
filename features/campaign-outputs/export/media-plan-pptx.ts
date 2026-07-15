import {
  detectImageContentType,
  fetchImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";
import { initialsFromCreatorName } from "@/lib/performance/creator-avatar";

import type { CampaignOutputContent } from "../output-types";
import type {
  MediaPlanCampaignContext,
  MediaPlanData,
  MediaPlanDay,
  MediaPlanDayType,
  MediaPlanDeadline,
  MediaPlanWeek,
} from "../generators/media-plan";
import {
  MEDIA_PLAN_COST_VAT_DISCLAIMER,
  formatMediaPlanPreparedForLabel,
} from "../generators/media-plan";
import { buildMediaPlanStrategyBlocks, type MediaPlanStrategyBlock } from "../media-plan-strategy-blocks";
import { formatMoney } from "../generators/generator-utils";
import {
  formatDayColumnDate,
  formatWeekRangeLabel,
  parseCampaignStartDate,
} from "../media-plan-week-range";
import {
  MEDIA_PLAN_AD_TYPE_COLORS,
  MEDIA_PLAN_BRAND,
  MEDIA_PLAN_DAY_TYPE_COLORS,
} from "../components/media-plan-brand";
import { mergeMediaPlanContext } from "../components/media-plan-context-merge";
import { isMediaPlanContent } from "./media-plan-content";
import { MEDIA_PLAN_PAGE } from "./media-plan-page";

const BLUE = hex(MEDIA_PLAN_BRAND.electricBlue);
const BLUE_300 = hex(MEDIA_PLAN_BRAND.blue300);
const NAVY = hex(MEDIA_PLAN_BRAND.deepNavy);
const DARK_BG = "05060C";
const INK = hex(MEDIA_PLAN_BRAND.ink);
const MUTED = hex(MEDIA_PLAN_BRAND.muted);
const LAVENDER = hex(MEDIA_PLAN_BRAND.lavender);
const LINE = "E2E7F5";
const CARD_BG = "F5F8FF";
const WHITE = hex(MEDIA_PLAN_BRAND.white);
const COVER_TEXT_SOFT = "B9C4E0";
const GREEN = "1D9E75";

const FONT = "Calibri";
const PAGE_W = 13.333;
const PAGE_H = 8.125;
const MARGIN_X = 0.5;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS_PER_CALENDAR_SLIDE = 2;

const GENERIC_OPERATIONAL_TYPES = new Set([
  "Stories",
  "Paid amplification",
  "Reporting",
  "Stories slot",
  "Performance review",
]);

const PLATFORM_BAR_COLORS = [
  BLUE,
  "3B82F6",
  "8B5CF6",
  "EC4899",
  "F59E0B",
  "10B981",
];

export type BuildMediaPlanPptxOptions = {
  contextOverride?: MediaPlanCampaignContext;
};

type PptxGen = InstanceType<typeof import("pptxgenjs").default>;
type Slide = ReturnType<PptxGen["addSlide"]>;

function hex(color: string): string {
  return color.replace("#", "");
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function typesForDay(day: MediaPlanDay): string[] {
  const primary = day.serviceTypes?.length
    ? day.serviceTypes
    : day.serviceType?.trim()
      ? [day.serviceType]
      : [];
  const additional =
    day.additionalDeliverables?.map((entry) => entry.serviceType).filter((type): type is string =>
      Boolean(type?.trim())
    ) ?? [];
  return [...new Set([...primary, ...additional])];
}

function collectLegendTypes(data: MediaPlanData): string[] {
  const fromDays = data.weeks.flatMap((week) => week.days.flatMap((day) => typesForDay(day)));
  const fromData = data.serviceTypes?.length ? data.serviceTypes : fromDays;
  return [...new Set(fromData)].filter(
    (type): type is string => Boolean(type?.trim() && !GENERIC_OPERATIONAL_TYPES.has(type))
  );
}

function buildAdTypeColorMap(types: string[]): Map<string, string> {
  return new Map(
    types.map((type, index) => [
      type,
      hex(MEDIA_PLAN_AD_TYPE_COLORS[index % MEDIA_PLAN_AD_TYPE_COLORS.length]!),
    ])
  );
}

function dayTypeColor(type: MediaPlanDayType): string {
  return hex(MEDIA_PLAN_DAY_TYPE_COLORS[type]);
}

function calendarSlotLabel(data: MediaPlanData): string {
  if (data.postingSlotCount && data.postingSlotCount !== data.creatorCount) {
    return `${data.postingSlotCount} ad slots · ${data.creatorCount} creators`;
  }
  if (data.postingSlotCount) {
    return `${data.postingSlotCount} deliverables`;
  }
  return `${data.creatorCount} creators`;
}

function platformAllocationBars(data: MediaPlanData): Array<{ platform: string; percentage: number }> {
  const entries = Object.entries(data.platformAllocation);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  return entries.map(([platform, count]) => ({
    platform,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));
}

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

async function resolveAvatarDataMap(data: MediaPlanData): Promise<Map<string, string>> {
  const urls = new Set<string>();
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.avatarUrl?.trim()) urls.add(day.avatarUrl.trim());
      for (const entry of day.additionalDeliverables ?? []) {
        if (entry.avatarUrl?.trim()) urls.add(entry.avatarUrl.trim());
      }
    }
  }
  for (const deadline of data.deadlines) {
    if (deadline.avatarUrl?.trim()) urls.add(deadline.avatarUrl.trim());
  }

  const entries = await Promise.all(
    [...urls].map(async (url) => {
      const imageData = await resolvePptxImageData(url);
      return imageData ? ([url, imageData] as const) : null;
    })
  );
  return new Map(entries.filter((entry): entry is readonly [string, string] => entry != null));
}

function addLogoMark(slide: Slide, x: number, y: number, size: number, theme: "dark" | "light"): void {
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
      x: x + markSize + 0.1,
      y: y - markSize * 0.18,
      w: 2.4,
      h: markSize * 1.4,
      fontFace: FONT,
      fontSize,
      bold: true,
      charSpacing: 1,
      valign: "middle",
    }
  );
}

function addDarkGlow(slide: Slide): void {
  slide.background = { color: DARK_BG };
  slide.addShape("ellipse", {
    x: PAGE_W - 5.8,
    y: -3.2,
    w: 8.5,
    h: 6.5,
    fill: { color: "7C3AED", transparency: 82 },
    line: { type: "none" },
  });
  slide.addShape("ellipse", {
    x: -3.8,
    y: PAGE_H - 3.2,
    w: 8.5,
    h: 6.5,
    fill: { color: BLUE, transparency: 82 },
    line: { type: "none" },
  });
}

function addSectionHeader(slide: Slide, label: string, title: string): void {
  addLogoLockup(slide, MARGIN_X, 0.28, 0.28, 9, "light");
  slide.addText(label.toUpperCase(), {
    x: MARGIN_X + 2.1,
    y: 0.3,
    w: 4,
    h: 0.22,
    fontFace: FONT,
    fontSize: 8.5,
    bold: true,
    color: MUTED,
    charSpacing: 2,
  });
  slide.addText(title, {
    x: MARGIN_X,
    y: 0.62,
    w: CONTENT_W,
    h: 0.42,
    fontFace: FONT,
    fontSize: 20,
    bold: true,
    color: INK,
  });
}

function addAvatarCircle(
  slide: Slide,
  avatarUrl: string | undefined,
  avatarData: string | undefined,
  name: string,
  x: number,
  y: number,
  size: number
): void {
  if (avatarUrl && avatarData) {
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
  const initial = initialsFromCreatorName(name);
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
    fontSize: 7,
    bold: true,
    color: WHITE,
  });
}

function addConfidenceBadge(slide: Slide, confidence: MediaPlanStrategyBlock["confidence"], x: number, y: number): void {
  if (!confidence) return;
  const color = confidence.level === "high" ? GREEN : confidence.level === "medium" ? "D97706" : "DC2626";
  slide.addShape("roundRect", {
    x,
    y,
    w: 1.35,
    h: 0.28,
    fill: { color: "F5F8FF" },
    line: { color: LINE, width: 0.5 },
    rectRadius: 0.06,
  });
  slide.addText(`Confidence: ${confidence.level.toUpperCase()}`, {
    x: x + 0.06,
    y: y + 0.02,
    w: 1.22,
    h: 0.12,
    fontFace: FONT,
    fontSize: 6.5,
    bold: true,
    color,
  });
  slide.addText(confidence.reason, {
    x: x + 0.06,
    y: y + 0.13,
    w: 1.22,
    h: 0.12,
    fontFace: FONT,
    fontSize: 5.5,
    color: MUTED,
  });
}

function addStrategySlide(pptx: PptxGen, data: MediaPlanData): void {
  const summary = data.strategySummary;
  if (!summary) return;

  const blocks = summary.hasContent
    ? buildMediaPlanStrategyBlocks(summary)
    : [{ label: "Strategy", body: "Strategy summary will appear here once the campaign brief or strategy section is complete.", kind: "narrative" as const }];

  const slide = pptx.addSlide();
  addSectionHeader(slide, "Campaign Strategy", "Media Plan");

  let y = 1.1;
  const colW = (CONTENT_W - 0.2) / 2;
  let col = 0;

  for (const block of blocks) {
    const x = MARGIN_X + col * (colW + 0.2);
    const blockH = block.kind === "weekly-grid" || block.kind === "creative-list" || block.kind === "executive" ? 0.95 : 0.75;

    slide.addShape("roundRect", {
      x,
      y,
      w: block.kind === "executive" || block.kind === "weekly-grid" || block.kind === "creative-list" ? CONTENT_W : colW,
      h: blockH,
      fill: { color: CARD_BG },
      line: { color: LINE, width: 0.5 },
      rectRadius: 0.08,
    });

    slide.addText(block.label.toUpperCase(), {
      x: x + 0.12,
      y: y + 0.06,
      w: colW - 0.2,
      h: 0.16,
      fontFace: FONT,
      fontSize: 7.5,
      bold: true,
      color: NAVY,
      charSpacing: 0.5,
    });

    if (block.confidence) {
      addConfidenceBadge(slide, block.confidence, x + (block.kind === "executive" ? CONTENT_W - 1.45 : colW - 1.35), y + 0.05);
    }

    let bodyText = block.body;
    if (block.kind === "weekly-grid" && block.weeklyObjectives?.length) {
      bodyText = block.weeklyObjectives
        .map((week) => `W${week.week} ${week.phase} (${week.weight}%): ${week.goals[0] ?? ""}`)
        .join("\n");
    } else if (block.kind === "creative-list" && block.creativeItems?.length) {
      bodyText = block.creativeItems
        .slice(0, 4)
        .map((entry) => `• ${entry.format} — ${entry.reason}`)
        .join("\n");
    } else if (block.kind === "tier-chips" && block.tierChips?.length) {
      bodyText = `${block.tierChips.map((chip) => `${chip.count} ${chip.tier}`).join(", ")}\n${block.body}`;
    } else if (block.kind === "platform-bars" && block.platformBars?.length) {
      bodyText = `${block.platformBars.map((bar) => `${bar.platform} ${bar.percentage}%`).join(" · ")}\n${block.body}`;
    }

    if (block.limitations) {
      bodyText = `${bodyText}\n⚠ ${block.limitations}`;
    }

    slide.addText(bodyText, {
      x: x + 0.12,
      y: y + 0.24,
      w: (block.kind === "executive" || block.kind === "weekly-grid" || block.kind === "creative-list" ? CONTENT_W : colW) - 0.24,
      h: blockH - 0.3,
      fontFace: FONT,
      fontSize: 9,
      color: INK,
      valign: "top",
    });

    if (block.kind === "executive" || block.kind === "weekly-grid" || block.kind === "creative-list") {
      y += blockH + 0.12;
      col = 0;
    } else {
      col += 1;
      if (col >= 2) {
        col = 0;
        y += blockH + 0.12;
      }
    }

    if (y > PAGE_H - 1.0) break;
  }
}

function addCoverSlide(
  pptx: PptxGen,
  content: CampaignOutputContent,
  data: MediaPlanData,
  context: MediaPlanCampaignContext | undefined
): void {
  const slide = pptx.addSlide();
  addDarkGlow(slide);
  addLogoLockup(slide, MARGIN_X, 0.55, 0.4, 12, "dark");

  slide.addText("Thinkway Media Plan", {
    x: MARGIN_X,
    y: 1.2,
    w: CONTENT_W,
    h: 0.28,
    fontFace: FONT,
    fontSize: 11,
    color: COVER_TEXT_SOFT,
  });

  slide.addText(content.title, {
    x: MARGIN_X,
    y: 1.65,
    w: CONTENT_W * 0.62,
    h: 0.9,
    fontFace: FONT,
    fontSize: 28,
    bold: true,
    color: WHITE,
  });

  if (content.summary) {
    slide.addText(content.summary, {
      x: MARGIN_X,
      y: 2.55,
      w: CONTENT_W * 0.58,
      h: 0.55,
      fontFace: FONT,
      fontSize: 11,
      color: COVER_TEXT_SOFT,
    });
  }

  const contextFields = [
    context?.groupName ? { label: "Group", value: context.groupName } : null,
    context?.clientName ? { label: "Legal entity", value: context.clientName } : null,
    context?.brandName ? { label: "Brand", value: context.brandName } : null,
    context?.agencyName ? { label: "Agency", value: context.agencyName } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (contextFields.length) {
    const colW = 1.45;
    contextFields.forEach((field, index) => {
      const x = MARGIN_X + index * colW;
      slide.addText(field.label.toUpperCase(), {
        x,
        y: 3.35,
        w: colW,
        h: 0.18,
        fontFace: FONT,
        fontSize: 7.5,
        bold: true,
        color: COVER_TEXT_SOFT,
        charSpacing: 1,
      });
      slide.addText(field.value, {
        x,
        y: 3.55,
        w: colW,
        h: 0.3,
        fontFace: FONT,
        fontSize: 10,
        bold: true,
        color: WHITE,
      });
    });
  }

  const adSlots = data.postingSlotCount ?? data.creatorCount;
  const stats = [
    { n: String(data.durationWeeks), l: "Weeks" },
    { n: String(adSlots), l: "Ad Slots" },
    { n: String(data.creatorCount), l: "Creators" },
  ];
  const statW = 1.15;
  const statStartX = PAGE_W - MARGIN_X - statW * 3 - 0.2;
  stats.forEach((stat, index) => {
    const x = statStartX + index * (statW + 0.1);
    slide.addShape("roundRect", {
      x,
      y: 1.55,
      w: statW,
      h: 0.95,
      fill: { color: NAVY, transparency: 35 },
      line: { color: BLUE, transparency: 55, pt: 0.5 },
      rectRadius: 0.08,
    });
    slide.addText(stat.n, {
      x,
      y: 1.68,
      w: statW,
      h: 0.42,
      align: "center",
      fontFace: FONT,
      fontSize: 22,
      bold: true,
      color: WHITE,
    });
    slide.addText(stat.l, {
      x,
      y: 2.12,
      w: statW,
      h: 0.22,
      align: "center",
      fontFace: FONT,
      fontSize: 8,
      color: COVER_TEXT_SOFT,
    });
  });

  if (context?.campaignCost) {
    slide.addShape("roundRect", {
      x: statStartX,
      y: 2.75,
      w: statW * 3 + 0.2,
      h: 0.95,
      fill: { color: GREEN, transparency: 12 },
      line: { color: GREEN, transparency: 40, pt: 0.5 },
      rectRadius: 0.08,
    });
    slide.addText("Campaign Cost", {
      x: statStartX + 0.15,
      y: 2.88,
      w: 2,
      h: 0.18,
      fontFace: FONT,
      fontSize: 8,
      bold: true,
      color: COVER_TEXT_SOFT,
    });
    slide.addText(formatMoney(context.campaignCost.amount, context.campaignCost.currency), {
      x: statStartX + 0.15,
      y: 3.08,
      w: statW * 3,
      h: 0.35,
      fontFace: FONT,
      fontSize: 18,
      bold: true,
      color: WHITE,
    });
    slide.addText(MEDIA_PLAN_COST_VAT_DISCLAIMER, {
      x: statStartX + 0.15,
      y: 3.45,
      w: statW * 3,
      h: 0.18,
      fontFace: FONT,
      fontSize: 7.5,
      color: COVER_TEXT_SOFT,
    });
  }

  const legendTypes = collectLegendTypes(data);
  if (legendTypes.length) {
    const typeColorMap = buildAdTypeColorMap(legendTypes);
    slide.addText("Ad Types", {
      x: MARGIN_X,
      y: PAGE_H - 1.35,
      w: 2,
      h: 0.2,
      fontFace: FONT,
      fontSize: 8,
      bold: true,
      color: COVER_TEXT_SOFT,
      charSpacing: 1.5,
    });
    const itemsPerRow = 4;
    legendTypes.slice(0, 8).forEach((type, index) => {
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;
      const x = MARGIN_X + col * 2.9;
      const y = PAGE_H - 1.05 + row * 0.28;
      slide.addShape("ellipse", {
        x,
        y: y + 0.05,
        w: 0.1,
        h: 0.1,
        fill: { color: typeColorMap.get(type) ?? MUTED },
        line: { type: "none" },
      });
      slide.addText(type, {
        x: x + 0.16,
        y,
        w: 2.6,
        h: 0.2,
        fontFace: FONT,
        fontSize: 8,
        color: COVER_TEXT_SOFT,
      });
    });
  }
}

function addDayCard(
  slide: Slide,
  day: MediaPlanDay,
  dayIndex: number,
  weekNum: number,
  campaignStart: Date,
  typeColorMap: Map<string, string>,
  avatarData: Map<string, string>,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  slide.addShape("roundRect", {
    x,
    y,
    w,
    h,
    fill: { color: CARD_BG },
    line: { color: LINE, pt: 0.5 },
    rectRadius: 0.05,
  });

  const dateStr = day.dateLabel ?? formatDayColumnDate(campaignStart, weekNum, dayIndex);
  const dayAbbr = (DAY_ABBR[dayIndex] ?? day.day).toUpperCase();
  slide.addText(dayAbbr, {
    x: x + 0.04,
    y: y + 0.04,
    w: w * 0.45,
    h: 0.14,
    fontFace: FONT,
    fontSize: 7,
    bold: true,
    color: MUTED,
  });
  slide.addText(dateStr, {
    x: x + w * 0.42,
    y: y + 0.04,
    w: w * 0.54,
    h: 0.14,
    align: "right",
    fontFace: FONT,
    fontSize: 7,
    color: MUTED,
  });

  const entries: Array<{ name: string; types: string[]; avatarUrl?: string }> = [];
  if (day.creator) {
    const primaryTypes =
      day.serviceTypes?.length
        ? day.serviceTypes
        : day.serviceType?.trim()
          ? [day.serviceType]
          : typesForDay(day);
    entries.push({
      name: day.shortName ?? day.creator,
      types: primaryTypes,
      avatarUrl: day.avatarUrl,
    });
    for (const extra of day.additionalDeliverables ?? []) {
      entries.push({
        name: extra.shortName ?? extra.creator ?? "Creator",
        types:
          extra.serviceTypes?.length
            ? extra.serviceTypes
            : extra.serviceType?.trim()
              ? [extra.serviceType]
              : [],
        avatarUrl: extra.avatarUrl,
      });
    }
  } else {
    const types = typesForDay(day);
    if (types.length) {
      entries.push({ name: day.label, types });
    } else {
      entries.push({ name: day.label, types: [] });
    }
  }

  let cardY = y + 0.22;
  for (const entry of entries.slice(0, 2)) {
    const avatarSize = 0.18;
    if (entry.name && entry.types.length) {
      addAvatarCircle(
        slide,
        entry.avatarUrl,
        entry.avatarUrl ? avatarData.get(entry.avatarUrl) : undefined,
        entry.name,
        x + 0.05,
        cardY,
        avatarSize
      );
      slide.addText(entry.name, {
        x: x + 0.28,
        y: cardY,
        w: w - 0.32,
        h: 0.16,
        fontFace: FONT,
        fontSize: 7,
        bold: true,
        color: INK,
        truncate: true,
      });
      const typeText = entry.types.join(", ");
      const dotColor = typeColorMap.get(entry.types[0] ?? "") ?? dayTypeColor(day.type);
      slide.addShape("ellipse", {
        x: x + 0.05,
        y: cardY + 0.2,
        w: 0.07,
        h: 0.07,
        fill: { color: dotColor },
        line: { type: "none" },
      });
      slide.addText(typeText, {
        x: x + 0.15,
        y: cardY + 0.18,
        w: w - 0.18,
        h: 0.14,
        fontFace: FONT,
        fontSize: 6.5,
        color: MUTED,
        truncate: true,
      });
      cardY += 0.42;
    } else {
      slide.addText(entry.name, {
        x: x + 0.05,
        y: cardY,
        w: w - 0.1,
        h: 0.3,
        fontFace: FONT,
        fontSize: 7,
        color: MUTED,
      });
      cardY += 0.3;
    }
  }
}

function addWeekBlock(
  slide: Slide,
  week: MediaPlanWeek,
  data: MediaPlanData,
  typeColorMap: Map<string, string>,
  avatarData: Map<string, string>,
  y: number
): number {
  const campaignStart = parseCampaignStartDate(data.campaignStartDate);
  const blockH = 1.55;
  slide.addShape("roundRect", {
    x: MARGIN_X,
    y,
    w: CONTENT_W,
    h: 0.28,
    fill: { color: LAVENDER },
    line: { type: "none" },
    rectRadius: 0.04,
  });
  slide.addText(`WEEK ${week.week}`, {
    x: MARGIN_X + 0.12,
    y: y + 0.04,
    w: 1.2,
    h: 0.2,
    fontFace: FONT,
    fontSize: 9,
    bold: true,
    color: BLUE,
  });
  slide.addText(formatWeekRangeLabel(campaignStart, week.week), {
    x: MARGIN_X + 1.3,
    y: y + 0.04,
    w: 2.5,
    h: 0.2,
    fontFace: FONT,
    fontSize: 8.5,
    color: INK,
  });
  slide.addText(`${week.phase} · Wave ${week.wave}`, {
    x: MARGIN_X + 3.8,
    y: y + 0.04,
    w: CONTENT_W - 4,
    h: 0.2,
    align: "right",
    fontFace: FONT,
    fontSize: 8,
    color: MUTED,
  });

  const gridY = y + 0.34;
  const colW = CONTENT_W / 7;
  const colH = blockH - 0.34;
  week.days.forEach((day, index) => {
    addDayCard(
      slide,
      day,
      index,
      week.week,
      campaignStart,
      typeColorMap,
      avatarData,
      MARGIN_X + index * colW + 0.02,
      gridY,
      colW - 0.04,
      colH
    );
  });

  return y + blockH + 0.12;
}

function addCalendarSlides(
  pptx: PptxGen,
  content: CampaignOutputContent,
  data: MediaPlanData,
  typeColorMap: Map<string, string>,
  avatarData: Map<string, string>
): void {
  const weekChunks = chunk(data.weeks, WEEKS_PER_CALENDAR_SLIDE);
  const slotLabel = calendarSlotLabel(data);

  weekChunks.forEach((weeks, slideIndex) => {
    const slide = pptx.addSlide();
    slide.background = { color: WHITE };
    addSectionHeader(slide, "Publishing Calendar", content.title);

    slide.addShape("roundRect", {
      x: MARGIN_X,
      y: 1.12,
      w: 2.4,
      h: 0.28,
      fill: { color: BLUE },
      line: { type: "none" },
      rectRadius: 0.14,
    });
    slide.addText(`${data.durationWeeks} weeks · ${slotLabel}`, {
      x: MARGIN_X + 0.12,
      y: 1.16,
      w: 2.2,
      h: 0.2,
      fontFace: FONT,
      fontSize: 8,
      bold: true,
      color: WHITE,
    });

    if (slideIndex === 0) {
      const legendTypes = collectLegendTypes(data).slice(0, 4);
      let legendX = MARGIN_X + 2.6;
      for (const type of legendTypes) {
        slide.addShape("ellipse", {
          x: legendX,
          y: 1.2,
          w: 0.08,
          h: 0.08,
          fill: { color: typeColorMap.get(type) ?? MUTED },
          line: { type: "none" },
        });
        slide.addText(type, {
          x: legendX + 0.12,
          y: 1.16,
          w: 1.4,
          h: 0.2,
          fontFace: FONT,
          fontSize: 7.5,
          color: MUTED,
        });
        legendX += 1.55;
      }
    }

    let y = 1.55;
    for (const week of weeks) {
      y = addWeekBlock(slide, week, data, typeColorMap, avatarData, y);
    }
  });
}

function addOperationsSlide(
  pptx: PptxGen,
  content: CampaignOutputContent,
  data: MediaPlanData
): void {
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addSectionHeader(slide, "Operations", content.title);

  const cardY = 1.25;
  const cardW = (CONTENT_W - 0.2) / 2;
  const cardH = 2.85;

  const addOpsCard = (title: string, x: number, y: number, w: number, h: number, body: string): void => {
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      fill: { color: CARD_BG },
      line: { color: LINE, pt: 0.5 },
      rectRadius: 0.06,
    });
    slide.addText(title, {
      x: x + 0.15,
      y: y + 0.12,
      w: w - 0.3,
      h: 0.22,
      fontFace: FONT,
      fontSize: 10,
      bold: true,
      color: INK,
    });
    slide.addText(body, {
      x: x + 0.15,
      y: y + 0.38,
      w: w - 0.3,
      h: h - 0.5,
      fontFace: FONT,
      fontSize: 8.5,
      color: INK,
      valign: "top",
    });
  };

  const wavesBody = data.waves
    .map((wave) => `Wave ${wave.wave} — ${wave.theme} (wk ${wave.weeks.join(", ")})`)
    .join("\n");
  addOpsCard("Activation Waves", MARGIN_X, cardY, cardW, cardH, wavesBody);

  const allocationBars = platformAllocationBars(data);
  let platformBody = "";
  if (allocationBars.length) {
    platformBody = allocationBars
      .map((entry, index) => {
        const bar = "█".repeat(Math.max(1, Math.round(entry.percentage / 10)));
        const color = PLATFORM_BAR_COLORS[index % PLATFORM_BAR_COLORS.length];
        return `${entry.platform} ${entry.percentage}% ${bar}`;
      })
      .join("\n");
  } else {
    platformBody = "No platform allocation data.";
  }
  addOpsCard("Platform Allocation", MARGIN_X + cardW + 0.2, cardY, cardW, cardH, platformBody);

  const milestonesBody = data.milestones
    .slice(0, 10)
    .map((milestone) => `Wk ${milestone.week} · ${milestone.label}`)
    .join("\n");
  addOpsCard("Milestones & Windows", MARGIN_X, cardY + cardH + 0.18, cardW, 2.2, milestonesBody);

  const depsBody =
    data.dependencies.length > 0
      ? data.dependencies.map((dep) => `${dep.creator} → ${dep.dependsOn}`).join("\n")
      : "No creator dependencies.";
  addOpsCard(
    "Creator Dependencies",
    MARGIN_X + cardW + 0.2,
    cardY + cardH + 0.18,
    cardW,
    2.2,
    depsBody
  );
}

function addDeadlinesSlide(
  pptx: PptxGen,
  content: CampaignOutputContent,
  data: MediaPlanData
): void {
  if (!data.deadlines.length) return;

  const slide = pptx.addSlide();
  slide.background = { color: WHITE };
  addSectionHeader(slide, "Production & Asset Delivery Deadlines", content.title);

  const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
    [
      { text: "Creator", options: { bold: true, color: MUTED, fontSize: 8 } },
      { text: "Deliverables", options: { bold: true, color: MUTED, fontSize: 8 } },
      { text: "Publish", options: { bold: true, color: MUTED, fontSize: 8 } },
      { text: "Production starts", options: { bold: true, color: MUTED, fontSize: 8 } },
      { text: "Assets due", options: { bold: true, color: MUTED, fontSize: 8 } },
    ],
  ];

  for (const deadline of data.deadlines.slice(0, 12)) {
    rows.push([
      { text: deadline.shortName ?? deadline.creator, options: { fontSize: 8, color: INK } },
      {
        text: formatDeadlineDeliverables(deadline),
        options: { fontSize: 8, color: INK },
      },
      {
        text: `Week ${deadline.publishWeek} · ${deadline.publishDay}`,
        options: { fontSize: 8, color: INK },
      },
      { text: deadline.productionStart, options: { fontSize: 8, color: MUTED } },
      { text: deadline.assetDelivery, options: { fontSize: 8, color: MUTED } },
    ]);
  }

  slide.addTable(rows, {
    x: MARGIN_X,
    y: 1.2,
    w: CONTENT_W,
    fontFace: FONT,
    border: { type: "solid", color: LINE, pt: 0.5 },
    fill: { color: WHITE },
    colW: [2.4, 2.8, 2.2, 2.2, 2.333],
    rowH: 0.32,
    autoPage: false,
  });

}

function formatDeadlineDeliverables(deadline: MediaPlanDeadline): string {
  const deliverables = deadline.serviceTypes?.length
    ? deadline.serviceTypes
    : deadline.serviceType?.trim()
      ? [deadline.serviceType]
      : [];
  return deliverables.length ? deliverables.join(", ") : "—";
}

function addCloseSlide(
  pptx: PptxGen,
  content: CampaignOutputContent,
  context: MediaPlanCampaignContext | undefined
): void {
  const slide = pptx.addSlide();
  addDarkGlow(slide);
  addLogoLockup(slide, MARGIN_X, PAGE_H / 2 - 1.2, 0.5, 14, "dark");

  slide.addText("Let's bring it to life.", {
    x: MARGIN_X,
    y: PAGE_H / 2 - 0.35,
    w: CONTENT_W,
    h: 0.7,
    fontFace: FONT,
    fontSize: 30,
    bold: true,
    color: WHITE,
  });

  const label = formatMediaPlanPreparedForLabel(context, content.title);
  slide.addText(`Thinkway Media Plan — prepared exclusively for ${label}`, {
    x: MARGIN_X,
    y: PAGE_H / 2 + 0.45,
    w: CONTENT_W,
    h: 0.35,
    fontFace: FONT,
    fontSize: 12,
    color: COVER_TEXT_SOFT,
  });

  slide.addText("thinkway.com", {
    x: MARGIN_X,
    y: PAGE_H / 2 + 0.9,
    w: CONTENT_W,
    h: 0.25,
    fontFace: FONT,
    fontSize: 11,
    bold: true,
    color: BLUE_300,
  });
}

/** Build the media plan as a landscape PowerPoint deck (cover → calendar → operations → deadlines → close). */
export async function buildMediaPlanPptxBuffer(
  content: CampaignOutputContent,
  options?: BuildMediaPlanPptxOptions
): Promise<Buffer> {
  if (!isMediaPlanContent(content)) {
    throw new Error("Media Plan PPTX export requires structured calendar data.");
  }

  const data = content.data;
  const context = mergeMediaPlanContext(data.campaignContext, options?.contextOverride);
  const typeColorMap = buildAdTypeColorMap(collectLegendTypes(data));
  const avatarData = await resolveAvatarDataMap(data);

  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({
    name: "MEDIA_PLAN",
    width: PAGE_W,
    height: PAGE_H,
  });
  pptx.layout = "MEDIA_PLAN";
  pptx.author = "Thinkway Platform";
  pptx.company = "Thinkway";
  pptx.title = `${content.title} — Media Plan`;

  addCoverSlide(pptx, content, data, context);
  addStrategySlide(pptx, data);
  addCalendarSlides(pptx, content, data, typeColorMap, avatarData);
  addOperationsSlide(pptx, content, data);
  addDeadlinesSlide(pptx, content, data);
  addCloseSlide(pptx, content, context);

  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return output;
}

/** Slide dimensions used by the media plan deck — matches PDF/HTML page size. */
export const MEDIA_PLAN_PPTX_PAGE = {
  widthIn: MEDIA_PLAN_PAGE.widthIn,
  heightIn: MEDIA_PLAN_PAGE.heightIn,
  width: PAGE_W,
  height: PAGE_H,
} as const;
