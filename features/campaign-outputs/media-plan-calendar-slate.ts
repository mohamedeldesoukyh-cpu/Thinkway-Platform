import type { SlateCreator } from "./output-inputs";
import { normalizeCreatorMatchKey } from "./hydration/quotation-service-types";
import { normalizeWeekWeights } from "./media-plan-schedule";

type CalendarDayLike = {
  creatorId?: string;
  creator?: string;
  shortName?: string;
  tier?: string;
  handle?: string;
  serviceType?: string;
  serviceTypes?: string[];
  platform?: string;
  isMirror?: boolean;
  isCompanion?: boolean;
  additionalDeliverables?: Array<{
    creatorId?: string;
    creator?: string;
    shortName?: string;
    handle?: string;
    tier?: string;
    serviceType?: string;
    serviceTypes?: string[];
    platform?: string;
    isMirror?: boolean;
    isCompanion?: boolean;
  }>;
};

export type MediaPlanCalendarSlateSource = {
  weeks: Array<{ days: CalendarDayLike[] }>;
};

type CalendarDayActivationLike = {
  type?: string;
  creatorId?: string;
  creator?: string;
};

/** Count primary calendar activations per week (companions/mirrors bundle onto one slot). */
export function countCalendarActivationsPerWeek(
  weeks: Array<{ days: CalendarDayActivationLike[] }>
): number[] {
  return weeks.map((week) =>
    week.days.reduce((count, day) => {
      if (day.type !== "content" && day.type !== "stories" && day.type !== "boost") return count;
      if (!day.creatorId?.trim() && !day.creator?.trim()) return count;
      return count + 1;
    }, 0)
  );
}

/** Normalize scheduled activations per week into display percentages (sum 100). */
export function deriveCalendarWeekWeights(
  weeks: Array<{ days: CalendarDayActivationLike[] }>,
  durationWeeks: number
): number[] {
  const counts = countCalendarActivationsPerWeek(weeks);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 0) {
    return normalizeWeekWeights(
      Array.from({ length: Math.max(1, durationWeeks) }, () => 100 / Math.max(1, durationWeeks)),
      durationWeeks
    );
  }
  return normalizeWeekWeights(counts, durationWeeks);
}

function mergeServiceTypes(...sources: Array<string[] | string | undefined>): string[] | undefined {
  const merged = [
    ...new Set(
      sources.flatMap((source) => {
        if (!source) return [];
        if (Array.isArray(source)) return source.filter((type) => type.trim());
        return source.trim() ? [source.trim()] : [];
      })
    ),
  ];
  return merged.length ? merged : undefined;
}

/** Build a creator slate from scheduled calendar rows (names, tiers, service types). */
export function slateFromMediaPlanCalendar(source: MediaPlanCalendarSlateSource): SlateCreator[] {
  const byKey = new Map<string, SlateCreator>();

  function addEntry(fields: CalendarDayLike | NonNullable<CalendarDayLike["additionalDeliverables"]>[number]) {
    if (fields.isMirror || fields.isCompanion) return;

    const displayName = fields.creator?.trim() || fields.shortName?.trim();
    if (!displayName) return;

    const key =
      fields.creatorId?.trim().toLowerCase() ||
      normalizeCreatorMatchKey(displayName);
    const existing = byKey.get(key);
    const serviceTypes = mergeServiceTypes(
      existing?.serviceTypes,
      fields.serviceTypes,
      fields.serviceType
    );

    byKey.set(key, {
      creatorId: fields.creatorId?.trim() || existing?.creatorId || key,
      displayName: existing?.displayName || displayName,
      tier: fields.tier?.trim() || existing?.tier?.trim() || undefined,
      handle: existing?.handle?.trim() || fields.handle?.trim() || undefined,
      platform: existing?.platform?.trim() || fields.platform?.trim() || undefined,
      serviceTypes,
      serviceLabel: serviceTypes?.join(" · "),
    });
  }

  for (const week of source.weeks) {
    for (const day of week.days) {
      if (day.creator?.trim() || day.shortName?.trim()) {
        addEntry(day);
      }
      for (const extra of day.additionalDeliverables ?? []) {
        addEntry(extra);
      }
    }
  }

  return [...byKey.values()];
}
