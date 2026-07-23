/**
 * Market Intelligence Engine — resolves purchase-cycle windows and scores
 * day/week slots for media plan scheduling.
 *
 * Additive only: returns neutral scores when disabled or no matching windows.
 */

import { MARKET_CALENDAR_EVENTS } from "./market-calendar-db";
import { industryBoostForEventType } from "./market-industry-intelligence";
import type {
  MarketCountry,
  MarketEvent,
  MarketEventType,
  MarketIndustryCategory,
  MarketIntelligenceConfig,
  MarketIntelligenceToggles,
  MarketOpportunityScore,
  MarketOpportunityWindow,
  MarketSchedulingContext,
} from "./types";

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map((part) => Number(part));
  return new Date(year!, month! - 1, day!, 12, 0, 0, 0);
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function lastBusinessDaysOfMonth(year: number, month: number, count: number): Date[] {
  const days: Date[] = [];
  const cursor = new Date(year, month, 0, 12, 0, 0, 0);
  while (days.length < count && cursor.getMonth() === month - 1) {
    if (isWeekday(cursor)) days.unshift(new Date(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }
  return days;
}

function firstWeekOfMonth(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const end = new Date(year, month - 1, 7, 12, 0, 0, 0);
  return { start, end };
}

function seasonMonths(season: "summer" | "winter" | "spring" | "autumn"): number[] {
  switch (season) {
    case "spring":
      return [3, 4, 5];
    case "summer":
      return [6, 7, 8];
    case "autumn":
      return [9, 10, 11];
    case "winter":
      return [12, 1, 2];
  }
}

function eventTypeAllowed(type: MarketEventType, toggles: MarketIntelligenceToggles): boolean {
  switch (type) {
    case "salary_period":
      return toggles.salaryCycle;
    case "retail_season":
    case "shopping_peak":
      return toggles.retailSeasons;
    case "religious_season":
      return toggles.ramadan;
    case "public_holiday":
      return toggles.publicHolidays;
    case "school_calendar":
      return toggles.schoolCalendar;
    case "weather_season":
    case "seasonal_behaviour":
      return toggles.weather;
    case "national_event":
    case "sports_event":
      return toggles.nationalEvents;
    case "industry_peak":
      return true;
    default:
      return true;
  }
}

function expandEventToWindows(
  event: MarketEvent,
  country: MarketCountry,
  rangeStart: Date,
  rangeEnd: Date
): MarketOpportunityWindow[] {
  const windows: MarketOpportunityWindow[] = [];

  const pushWindow = (start: Date, end: Date) => {
    if (end < rangeStart || start > rangeEnd) return;
    windows.push({
      eventId: event.id,
      eventName: event.name,
      eventType: event.type,
      country,
      start,
      end,
      peakStrength: event.peakStrength,
      rationale: event.rationale ?? `${event.name} — elevated purchase intent`,
    });
  };

  if (event.dateRanges?.length) {
    for (const range of event.dateRanges) {
      pushWindow(parseIsoDate(range.start), parseIsoDate(range.end));
    }
    return windows;
  }

  const startYear = rangeStart.getFullYear();
  const endYear = rangeEnd.getFullYear();

  for (let year = startYear; year <= endYear; year += 1) {
    const recurrence = event.recurrence;
    if (recurrence.kind === "fixed") {
      const dayEnd = recurrence.dayEnd ?? recurrence.dayStart;
      pushWindow(
        new Date(year, recurrence.month - 1, recurrence.dayStart, 12, 0, 0, 0),
        new Date(year, recurrence.month - 1, dayEnd, 12, 0, 0, 0)
      );
    } else if (recurrence.kind === "month_end") {
      for (let month = 1; month <= 12; month += 1) {
        const days = lastBusinessDaysOfMonth(year, month, recurrence.lastBusinessDays ?? 5);
        if (days.length) {
          pushWindow(days[0]!, days[days.length - 1]!);
        }
      }
    } else if (recurrence.kind === "month_start") {
      for (let month = 1; month <= 12; month += 1) {
        const { start, end } = firstWeekOfMonth(year, month);
        pushWindow(start, end);
      }
    } else if (recurrence.kind === "season") {
      for (const month of seasonMonths(recurrence.season)) {
        const y = month === 12 && recurrence.season === "winter" ? year : year;
        const start = new Date(y, month - 1, 1, 12, 0, 0, 0);
        const end = new Date(y, month - 1, 28, 12, 0, 0, 0);
        pushWindow(start, end);
      }
    }
  }

  return windows;
}

/** Resolve all applicable market windows for countries, date range, and toggles. */
export function resolveMarketWindows(input: {
  countries: MarketCountry[];
  startDate: Date;
  endDate: Date;
  config: MarketIntelligenceConfig;
}): MarketOpportunityWindow[] {
  if (!input.config.enabled) return [];

  const windows: MarketOpportunityWindow[] = [];
  const seen = new Set<string>();

  for (const country of input.countries) {
    for (const event of MARKET_CALENDAR_EVENTS) {
      if (!event.countries.includes(country)) continue;
      if (!eventTypeAllowed(event.type, input.config.toggles)) continue;

      for (const window of expandEventToWindows(event, country, input.startDate, input.endDate)) {
        const key = `${window.eventId}:${country}:${formatIsoDate(window.start)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        windows.push(window);
      }
    }
  }

  return windows;
}

function dateInWindow(date: Date, window: MarketOpportunityWindow): boolean {
  const time = date.getTime();
  return time >= window.start.getTime() && time <= window.end.getTime();
}

/** Score a single calendar date for market opportunity. */
export function scoreMarketOpportunityForDate(
  date: Date,
  windows: MarketOpportunityWindow[],
  category: MarketIndustryCategory,
  config: MarketIntelligenceConfig
): MarketOpportunityScore {
  if (!config.enabled || !windows.length) {
    return { score: 50, reasons: [], activeWindows: [] };
  }

  const active: MarketOpportunityWindow[] = [];
  let rawScore = 50;
  const reasons: string[] = [];

  for (const window of windows) {
    if (!dateInWindow(date, window)) continue;
    if (!eventCategoryMatch(window, category)) continue;
    active.push(window);
    const categoryBoost = industryBoostForEventType(category, window.eventType);
    const contribution = window.peakStrength * categoryBoost;
    rawScore = Math.max(rawScore, contribution);
    if (reasons.length < 4) {
      reasons.push(window.rationale);
    }
  }

  const activeNames = [...new Set(active.map((w) => w.eventName))];
  return {
    score: clamp(rawScore),
    reasons: reasons.slice(0, 4),
    activeWindows: activeNames,
  };
}

function eventCategoryMatch(window: MarketOpportunityWindow, category: MarketIndustryCategory): boolean {
  const event = MARKET_CALENDAR_EVENTS.find((entry) => entry.id === window.eventId);
  if (!event?.relevantCategories?.length) return true;
  return event.relevantCategories.includes(category);
}

/** Score a campaign week (1-based) by averaging daily opportunity across Mon–Sun. */
export function scoreMarketOpportunityForWeek(
  campaignStart: Date,
  week: number,
  context: Pick<MarketSchedulingContext, "windows" | "category" | "config">
): MarketOpportunityScore {
  if (!context.config.enabled) {
    return { score: 50, reasons: [], activeWindows: [] };
  }

  const scores: MarketOpportunityScore[] = [];
  for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
    const date = new Date(campaignStart);
    date.setDate(date.getDate() + (week - 1) * 7 + dayIndex);
    scores.push(
      scoreMarketOpportunityForDate(date, context.windows, context.category, context.config)
    );
  }

  const avgScore =
    scores.reduce((sum, entry) => sum + entry.score, 0) / Math.max(1, scores.length);
  const allReasons = [...new Set(scores.flatMap((entry) => entry.reasons))].slice(0, 4);
  const allWindows = [...new Set(scores.flatMap((entry) => entry.activeWindows))];

  return {
    score: clamp(avgScore),
    reasons: allReasons,
    activeWindows: allWindows,
  };
}

/** Build scheduling context for a campaign flight. */
export function buildMarketSchedulingContext(input: {
  campaignStartDate: Date;
  durationWeeks: number;
  config: MarketIntelligenceConfig;
}): MarketSchedulingContext {
  const endDate = new Date(input.campaignStartDate);
  endDate.setDate(endDate.getDate() + input.durationWeeks * 7);

  const windows = resolveMarketWindows({
    countries: input.config.countries ?? ["UAE"],
    startDate: input.campaignStartDate,
    endDate,
    config: input.config,
  });

  return {
    campaignStartDate: input.campaignStartDate,
    durationWeeks: input.durationWeeks,
    countries: input.config.countries ?? ["UAE"],
    category: input.config.category ?? "general",
    config: input.config,
    windows,
  };
}

/**
 * Day-placement modifier — subtract from placement penalty (lower = better slot).
 * Capped so market never overrides spacing or pinned constraints.
 */
export function marketDayPlacementBonus(
  absoluteDay: number,
  context: MarketSchedulingContext | undefined
): { bonus: number; score: MarketOpportunityScore } {
  const neutral = { bonus: 0, score: { score: 50, reasons: [], activeWindows: [] } };
  if (!context?.config.enabled) return neutral;

  const date = new Date(context.campaignStartDate);
  date.setDate(date.getDate() + absoluteDay);
  const score = scoreMarketOpportunityForDate(
    date,
    context.windows,
    context.category,
    context.config
  );
  const multiplier = context.config.influenceMultiplier ?? 1;
  const bonus = ((score.score - 50) / 50) * 18 * multiplier;
  return { bonus, score };
}

/**
 * Week-allocation modifier — added to week emphasis score.
 */
export function marketWeekAllocationBonus(
  week: number,
  context: MarketSchedulingContext | undefined
): { bonus: number; score: MarketOpportunityScore } {
  const neutral = { bonus: 0, score: { score: 50, reasons: [], activeWindows: [] } };
  if (!context?.config.enabled) return neutral;

  const score = scoreMarketOpportunityForWeek(context.campaignStartDate, week, context);
  const multiplier = context.config.influenceMultiplier ?? 1;
  const bonus = ((score.score - 50) / 50) * 22 * multiplier;
  return { bonus, score };
}

/** Describe trade-off when placement lands outside high-opportunity windows. */
export function describeMarketTradeoff(
  placedScore: MarketOpportunityScore,
  idealScore: number,
  constraint: string
): string | undefined {
  if (placedScore.score >= idealScore - 8) return undefined;
  return `Market ideal timing (${idealScore}/100) deferred — ${constraint} took priority (placed slot ${placedScore.score}/100)`;
}
