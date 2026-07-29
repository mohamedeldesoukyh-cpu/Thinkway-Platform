/**
 * Media Plan → styled Excel workbook (calendar grid + milestones).
 */
import {
  buildStyledExcelBuffer,
  type StyledDataRow,
  type StyledSheetConfig,
} from "@/lib/reports/document/excel-report-builder";

import type { CampaignOutputContent } from "../output-types";
import type { MediaPlanData } from "../generators/media-plan";
import { formatMoney } from "../generators/generator-utils";
import { MEDIA_PLAN_PRICING_DISCLAIMER } from "../generators/media-plan";
import { PUBLISHING_CALENDAR_DAYS } from "../media-plan-week-start";
import { isMediaPlanContent } from "./media-plan-export-utils";

/** Publishing Calendar columns — Saturday→Friday (dayIndex 0 = Saturday). */
const DAY_HEADERS = [...PUBLISHING_CALENDAR_DAYS];

function formatDayCell(day: MediaPlanData["weeks"][number]["days"][number]): string {
  const types =
    day.serviceTypes?.length
      ? day.serviceTypes.join(", ")
      : day.serviceType?.trim() || day.label;
  const creator = day.shortName ?? day.creator;
  const date = day.dateLabel ? ` (${day.dateLabel})` : "";
  if (creator) return `${creator}${date} — ${types}`;
  return `${day.day}${date}: ${types}`;
}

function calendarRows(data: MediaPlanData): StyledDataRow[] {
  return data.weeks.map((week) => ({
    kind: "data" as const,
    values: [
      `Week ${week.week} — ${week.phase} (Wave ${week.wave})`,
      ...week.days.map((day) => formatDayCell(day)),
    ],
  }));
}

function milestoneRows(data: MediaPlanData): StyledDataRow[] {
  return data.milestones.map((milestone) => ({
    kind: "data" as const,
    values: [milestone.type, milestone.week, milestone.label],
  }));
}

function waveRows(data: MediaPlanData): StyledDataRow[] {
  return data.waves.map((wave) => ({
    kind: "data" as const,
    values: [wave.wave, wave.weeks.join(", "), wave.theme],
  }));
}

export type BuildMediaPlanExcelOptions = {
  /** When false, omit campaign cost from sheet meta. Defaults to true. */
  includeCampaignCost?: boolean;
};

export async function buildMediaPlanExcel(
  content: CampaignOutputContent,
  options?: BuildMediaPlanExcelOptions
): Promise<Buffer> {
  if (!isMediaPlanContent(content)) {
    throw new Error("Media Plan export requires structured calendar data.");
  }

  const data = content.data;
  const ctx = data.campaignContext;
  const includeCampaignCost = options?.includeCampaignCost !== false;
  const meta: Array<{ label: string; value: string }> = [
    { label: "Duration", value: `${data.durationWeeks} weeks` },
    { label: "Creators", value: String(data.creatorCount) },
  ];
  if (data.postingSlotCount) {
    meta.push({ label: "Ad slots", value: String(data.postingSlotCount) });
  }
  if (data.campaignStartDate) {
    meta.push({ label: "Start", value: data.campaignStartDate });
  }
  if (ctx?.groupName) meta.push({ label: "Group", value: ctx.groupName });
  if (ctx?.brandName) meta.push({ label: "Brand", value: ctx.brandName });
  if (ctx?.agencyName) meta.push({ label: "Agency", value: ctx.agencyName });
  if (includeCampaignCost && ctx?.campaignCost) {
    meta.push({
      label: "Campaign cost",
      value: `${formatMoney(ctx.campaignCost.amount, ctx.campaignCost.currency)} (${MEDIA_PLAN_PRICING_DISCLAIMER})`,
    });
  }

  const calendarSheet: StyledSheetConfig = {
    name: "Calendar",
    header: {
      title: `Thinkway — ${content.title}`,
      entityLine: [ctx?.groupName, ctx?.brandName].filter(Boolean).join(" · ") || undefined,
      meta,
      generatedAt: new Date(),
    },
    columnHeaders: [["Week", ...DAY_HEADERS]],
    rows: calendarRows(data),
    columnFormats: ["text", ...DAY_HEADERS.map(() => "text" as const)],
  };

  const detailSheet: StyledSheetConfig = {
    name: "Waves & Milestones",
    header: {
      title: "Activation detail",
      generatedAt: new Date(),
    },
    columnHeaders: [
      ["Activation Waves", "", ""],
      ["Wave", "Weeks", "Theme"],
    ],
    rows: [
      ...waveRows(data),
      { kind: "emphasis", values: ["Milestones", "", ""] },
      ...milestoneRows(data),
    ],
    columnFormats: ["text", "text", "text"],
  };

  return buildStyledExcelBuffer([calendarSheet, detailSheet]);
}
