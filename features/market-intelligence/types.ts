/**
 * Market Intelligence — consumer purchase behaviour signals for media plan scheduling.
 */

/** Supported markets — extensible via market-calendar-db. */
export type MarketCountry =
  | "UAE"
  | "Saudi Arabia"
  | "Egypt"
  | "Kuwait"
  | "Qatar"
  | "Bahrain"
  | "Oman"
  | "Jordan"
  | "Morocco"
  | "Turkey"
  | "UK"
  | "USA";

export type MarketEventType =
  | "salary_period"
  | "religious_season"
  | "retail_season"
  | "national_event"
  | "seasonal_behaviour"
  | "industry_peak"
  | "public_holiday"
  | "school_calendar"
  | "weather_season"
  | "sports_event"
  | "shopping_peak";

/** Campaign category verticals for industry-intelligence mapping. */
export type MarketIndustryCategory =
  | "food"
  | "fashion"
  | "electronics"
  | "travel"
  | "beauty"
  | "telecom"
  | "finance"
  | "general";

export type MarketEventRecurrence =
  | { kind: "fixed"; month: number; dayStart: number; dayEnd?: number }
  | { kind: "month_end"; lastBusinessDays?: number }
  | { kind: "month_start"; firstWeek?: boolean }
  | { kind: "season"; hemisphere: "northern" | "southern"; season: "summer" | "winter" | "spring" | "autumn" };

export type MarketEvent = {
  id: string;
  name: string;
  type: MarketEventType;
  countries: MarketCountry[];
  /** 0–100 — higher = stronger purchase-intent lift. */
  peakStrength: number;
  recurrence: MarketEventRecurrence;
  /** ISO date overrides for non-recurring or lunar events (year-specific). */
  dateRanges?: Array<{ start: string; end: string }>;
  relevantCategories?: MarketIndustryCategory[];
  rationale?: string;
};

export type MarketOpportunityWindow = {
  eventId: string;
  eventName: string;
  eventType: MarketEventType;
  country: MarketCountry;
  start: Date;
  end: Date;
  peakStrength: number;
  rationale: string;
};

export type MarketIntelligenceToggles = {
  salaryCycle: boolean;
  retailSeasons: boolean;
  ramadan: boolean;
  publicHolidays: boolean;
  schoolCalendar: boolean;
  weather: boolean;
  nationalEvents: boolean;
};

export type MarketIntelligenceConfig = {
  /** Master switch — when false, market scoring is neutral. */
  enabled: boolean;
  toggles: MarketIntelligenceToggles;
  /**
   * Resolved market countries — always present after `resolveMarketIntelligenceConfig`
   * (meta override → campaign geography → UAE default).
   */
  countries: MarketCountry[];
  /** Industry category for peak matching. */
  category?: MarketIndustryCategory;
  /** Weight multiplier 0–1 applied to market influence (default 1). */
  influenceMultiplier?: number;
};

export const DEFAULT_MARKET_INTELLIGENCE_TOGGLES: MarketIntelligenceToggles = {
  salaryCycle: true,
  retailSeasons: true,
  ramadan: true,
  publicHolidays: true,
  schoolCalendar: true,
  weather: true,
  nationalEvents: true,
};

export const DEFAULT_MARKET_INTELLIGENCE_CONFIG: MarketIntelligenceConfig = {
  enabled: true,
  toggles: { ...DEFAULT_MARKET_INTELLIGENCE_TOGGLES },
  countries: ["UAE"],
};

export type MarketOpportunityScore = {
  /** Normalised 0–100 opportunity score for a date or week. */
  score: number;
  reasons: string[];
  activeWindows: string[];
  /** When scheduling conflicts with ideal market timing. */
  tradeoffs?: string[];
};

export type MarketSchedulingContext = {
  campaignStartDate: Date;
  durationWeeks: number;
  countries: MarketCountry[];
  category: MarketIndustryCategory;
  config: MarketIntelligenceConfig;
  /** Pre-resolved windows for the campaign date range. */
  windows: MarketOpportunityWindow[];
};
