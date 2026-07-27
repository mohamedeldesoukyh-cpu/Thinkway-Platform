/**
 * Adapt Media Plan Engine items/projections ↔ Studio MediaPlanData
 * so Campaign Original/Actual/Remaining all render through MediaPlanCalendar.
 */

import type {
  MediaPlanData,
  MediaPlanDay,
  MediaPlanWeek,
} from "@/features/campaign-outputs/generators/media-plan";
import {
  dateForCampaignSlot,
  parseCampaignStartDate,
} from "@/features/campaign-outputs/media-plan-week-range";

import type { MediaPlanItem, MediaPlanViewKind } from "./types";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function classifyDayType(deliverable: string): MediaPlanDay["type"] {
  const lower = deliverable.toLowerCase();
  if (lower.includes("stor")) return "stories";
  if (lower.includes("boost") || lower.includes("paid") || lower.includes("amplif")) return "boost";
  if (lower.includes("report") || lower.includes("monitor")) return "monitoring";
  return "content";
}

/** Convert a Studio calendar grid into engine MediaPlanItem rows. */
export function mediaPlanDataToItems(data: MediaPlanData): MediaPlanItem[] {
  const start = parseCampaignStartDate(data.campaignStartDate);
  const items: MediaPlanItem[] = [];

  for (const week of data.weeks) {
    week.days.forEach((day, dayIndex) => {
      if (!day.creatorId && !day.creator) return;
      const plannedDate = toIsoDate(dateForCampaignSlot(start, week.week, dayIndex));
      const deliverables =
        day.serviceTypes?.length
          ? day.serviceTypes
          : day.serviceType
            ? [day.serviceType]
            : day.label
              ? [day.label]
              : ["Deliverable"];

      for (const deliverable of deliverables) {
        items.push({
          id: `${day.creatorId ?? day.creator ?? "unknown"}::${week.week}::${dayIndex}::${deliverable}`,
          creatorId: day.creatorId ?? day.creator ?? "unknown",
          creatorName: day.creator ?? day.shortName ?? day.creatorId ?? "Creator",
          platform: day.platform ?? "Unknown",
          deliverable,
          plannedDate,
          actualLiveDate: null,
          status: "planned",
        });
      }

      for (const extra of day.additionalDeliverables ?? []) {
        const extraTypes =
          extra.serviceTypes?.length
            ? extra.serviceTypes
            : extra.serviceType
              ? [extra.serviceType]
              : [];
        for (const deliverable of extraTypes) {
          items.push({
            id: `${extra.creatorId ?? day.creatorId ?? "unknown"}::${week.week}::${dayIndex}::${deliverable}::extra`,
            creatorId: extra.creatorId ?? day.creatorId ?? "unknown",
            creatorName: extra.creator ?? day.creator ?? "Creator",
            platform: extra.platform ?? day.platform ?? "Unknown",
            deliverable,
            plannedDate,
            actualLiveDate: null,
            status: "planned",
          });
        }
      }
    });
  }

  return items;
}

export type ItemsToMediaPlanDataOptions = {
  campaignStartDate: string;
  durationWeeks?: number;
  viewKind?: MediaPlanViewKind;
  /** Use actualLiveDate for placement (Actual) or plannedDate (Original/Remaining). */
  dateField?: "plannedDate" | "actualLiveDate";
  titleHint?: string;
};

/**
 * Build a MediaPlanData grid from engine items for MediaPlanCalendar.
 * Same component for Original / Actual / Remaining — only the item set differs.
 */
export function itemsToMediaPlanData(
  items: MediaPlanItem[],
  options: ItemsToMediaPlanDataOptions
): MediaPlanData {
  const dateField = options.dateField ?? "plannedDate";
  const start = parseCampaignStartDate(options.campaignStartDate);
  const startMs = start.getTime();

  const dated = items.filter((item) => item[dateField]);
  let maxWeek = Math.max(1, options.durationWeeks ?? 4);

  type SlotKey = string;
  const slots = new Map<
    SlotKey,
    {
      week: number;
      dayIndex: number;
      creatorId: string;
      creatorName: string;
      platform: string;
      deliverables: string[];
    }
  >();

  for (const item of dated) {
    const iso = item[dateField]!;
    const date = parseCampaignStartDate(iso);
    const diffDays = Math.round((date.getTime() - startMs) / (24 * 60 * 60 * 1000));
    const week = Math.max(1, Math.floor(diffDays / 7) + 1);
    const dayIndex = ((diffDays % 7) + 7) % 7;
    maxWeek = Math.max(maxWeek, week);

    const key = `${week}::${dayIndex}::${item.creatorId}`;
    const existing = slots.get(key);
    if (existing) {
      if (!existing.deliverables.includes(item.deliverable)) {
        existing.deliverables.push(item.deliverable);
      }
    } else {
      slots.set(key, {
        week,
        dayIndex,
        creatorId: item.creatorId,
        creatorName: item.creatorName,
        platform: item.platform,
        deliverables: [item.deliverable],
      });
    }
  }

  const weeks: MediaPlanWeek[] = [];
  for (let week = 1; week <= maxWeek; week += 1) {
    const days: MediaPlanDay[] = DAY_NAMES.map((dayName, dayIndex) => {
      const matches = [...slots.values()].filter(
        (slot) => slot.week === week && slot.dayIndex === dayIndex
      );
      if (!matches.length) {
        return {
          day: dayName,
          type: "content" as const,
          label: "",
        };
      }

      // First creator owns the primary cell; others pack as additionalDeliverables.
      const [primary, ...rest] = matches;
      const primaryTypes = primary!.deliverables;
      return {
        day: dayName,
        type: classifyDayType(primaryTypes[0] ?? ""),
        label: primaryTypes[0] ?? primary!.creatorName,
        creatorId: primary!.creatorId,
        creator: primary!.creatorName,
        shortName: primary!.creatorName,
        platform: primary!.platform,
        serviceType: primaryTypes[0],
        serviceTypes: primaryTypes,
        additionalDeliverables: rest.flatMap((slot) =>
          slot.deliverables.map((deliverable) => ({
            creatorId: slot.creatorId,
            creator: slot.creatorName,
            shortName: slot.creatorName,
            platform: slot.platform,
            serviceType: deliverable,
            serviceTypes: [deliverable],
          }))
        ),
      };
    });

    weeks.push({
      week,
      wave: Math.ceil(week / 2),
      phase: options.viewKind === "actual" ? "Actual" : options.viewKind === "remaining" ? "Remaining" : "Original",
      days,
    });
  }

  const serviceTypes = [...new Set(dated.map((item) => item.deliverable))];
  const creatorIds = new Set(dated.map((item) => item.creatorId));

  return {
    durationWeeks: options.durationWeeks ?? maxWeek,
    calendarWeeks: maxWeek,
    campaignStartDate: options.campaignStartDate,
    scheduledStartDate: options.campaignStartDate,
    weeks,
    waves: [],
    milestones: [],
    platformAllocation: {},
    dependencies: [],
    deadlines: [],
    creatorCount: creatorIds.size,
    postingSlotCount: dated.length,
    unscheduledDeliverableCount: items.filter((item) => !item[dateField]).length,
    serviceTypes,
    planMode: "planning",
    generatorVersion: "media-plan-engine-adapter",
  };
}

/** Empty calendar shell when a view has no data yet. */
export function emptyMediaPlanData(
  campaignStartDate: string,
  durationWeeks = 4
): MediaPlanData {
  return itemsToMediaPlanData([], {
    campaignStartDate,
    durationWeeks,
  });
}
