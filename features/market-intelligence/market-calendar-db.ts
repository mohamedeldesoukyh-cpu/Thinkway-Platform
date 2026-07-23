/**
 * Centralised market calendar — public holidays, retail peaks, salary behaviour,
 * religious seasons, and national events per country.
 *
 * Structured TypeScript data (no DB migration). Extend with Google Trends etc. later.
 */

import { resolveCountryCode } from "@/lib/creators/country-code";

import type { MarketCountry, MarketEvent, MarketEventType } from "./types";

const GCC: MarketCountry[] = ["UAE", "Saudi Arabia", "Kuwait", "Qatar", "Bahrain", "Oman"];
const MENA: MarketCountry[] = [...GCC, "Egypt", "Jordan", "Morocco"];

/** Year-specific lunar/variable windows — update annually or via future dynamic resolver. */
const LUNAR_2026: Record<string, Array<{ start: string; end: string }>> = {
  ramadan: [{ start: "2026-02-18", end: "2026-03-19" }],
  eid_al_fitr: [{ start: "2026-03-20", end: "2026-03-25" }],
  eid_al_adha: [{ start: "2026-05-27", end: "2026-06-01" }],
};

function salaryEvents(countries: MarketCountry[]): MarketEvent[] {
  return [
    {
      id: "salary-month-end",
      name: "Salary payout window",
      type: "salary_period",
      countries,
      peakStrength: 72,
      recurrence: { kind: "month_end", lastBusinessDays: 5 },
      relevantCategories: ["fashion", "electronics", "beauty", "food", "telecom"],
      rationale: "Disposable income peaks in the last 5 business days of the month",
    },
    {
      id: "salary-first-week",
      name: "Post-salary spending week",
      type: "salary_period",
      countries,
      peakStrength: 85,
      recurrence: { kind: "month_start", firstWeek: true },
      relevantCategories: ["fashion", "electronics", "beauty", "travel", "food"],
      rationale: "First week after salary — highest conversion intent for discretionary purchases",
    },
  ];
}

function retailEvents(): MarketEvent[] {
  return [
    {
      id: "white-friday",
      name: "White Friday",
      type: "retail_season",
      countries: MENA,
      peakStrength: 92,
      recurrence: { kind: "fixed", month: 11, dayStart: 24, dayEnd: 30 },
      relevantCategories: ["fashion", "electronics", "beauty"],
      rationale: "MENA equivalent of Black Friday — peak e-commerce and mall traffic",
    },
    {
      id: "black-friday",
      name: "Black Friday",
      type: "retail_season",
      countries: ["UK", "USA"],
      peakStrength: 95,
      recurrence: { kind: "fixed", month: 11, dayStart: 28, dayEnd: 29 },
      relevantCategories: ["fashion", "electronics", "beauty"],
      rationale: "Major retail discount event driving purchase urgency",
    },
    {
      id: "cyber-monday",
      name: "Cyber Monday",
      type: "retail_season",
      countries: ["UK", "USA", "UAE"],
      peakStrength: 88,
      recurrence: { kind: "fixed", month: 12, dayStart: 1, dayEnd: 2 },
      relevantCategories: ["electronics", "fashion"],
      rationale: "Online shopping peak following Black Friday weekend",
    },
    {
      id: "back-to-school",
      name: "Back to School",
      type: "school_calendar",
      countries: ["UAE", "Saudi Arabia", "Egypt", "Jordan", "UK", "USA"],
      peakStrength: 78,
      recurrence: { kind: "fixed", month: 8, dayStart: 15, dayEnd: 31 },
      relevantCategories: ["fashion", "electronics", "food"],
      rationale: "School reopening drives family spending on apparel, devices, and supplies",
    },
    {
      id: "summer-sales",
      name: "Summer end-of-season sales",
      type: "retail_season",
      countries: [...MENA, "UK", "Turkey"],
      peakStrength: 70,
      recurrence: { kind: "fixed", month: 7, dayStart: 1, dayEnd: 31 },
      relevantCategories: ["fashion", "travel", "beauty"],
      rationale: "Mid-summer clearance and holiday prep purchasing",
    },
    {
      id: "singles-day",
      name: "Singles Day / 11.11",
      type: "shopping_peak",
      countries: ["UAE", "Saudi Arabia", "Egypt", "UK"],
      peakStrength: 82,
      recurrence: { kind: "fixed", month: 11, dayStart: 10, dayEnd: 12 },
      relevantCategories: ["electronics", "fashion", "beauty"],
      rationale: "Global e-commerce mega-sale — strong cross-border shopping in MENA",
    },
    {
      id: "amazon-prime-day",
      name: "Amazon Prime Day",
      type: "shopping_peak",
      countries: ["UAE", "Saudi Arabia", "UK", "USA"],
      peakStrength: 80,
      recurrence: { kind: "fixed", month: 7, dayStart: 14, dayEnd: 16 },
      relevantCategories: ["electronics", "beauty", "food"],
      rationale: "Prime member exclusives drive electronics and FMCG basket growth",
    },
  ];
}

function religiousEvents(): MarketEvent[] {
  return [
    {
      id: "ramadan",
      name: "Ramadan",
      type: "religious_season",
      countries: MENA,
      peakStrength: 75,
      recurrence: { kind: "fixed", month: 2, dayStart: 18, dayEnd: 19 },
      dateRanges: LUNAR_2026.ramadan,
      relevantCategories: ["food", "fashion", "beauty", "telecom"],
      rationale: "Evening engagement peaks; food and gifting categories surge pre-Iftar",
    },
    {
      id: "eid-al-fitr",
      name: "Eid Al-Fitr",
      type: "religious_season",
      countries: MENA,
      peakStrength: 90,
      recurrence: { kind: "fixed", month: 3, dayStart: 20, dayEnd: 25 },
      dateRanges: LUNAR_2026.eid_al_fitr,
      relevantCategories: ["fashion", "beauty", "food", "travel"],
      rationale: "Celebration spending — apparel, gifting, and dining peak over Eid week",
    },
    {
      id: "eid-al-adha",
      name: "Eid Al-Adha",
      type: "religious_season",
      countries: MENA,
      peakStrength: 82,
      recurrence: { kind: "fixed", month: 5, dayStart: 27, dayEnd: 31 },
      dateRanges: LUNAR_2026.eid_al_adha,
      relevantCategories: ["fashion", "travel", "food"],
      rationale: "Holiday travel and celebration purchases intensify",
    },
    {
      id: "christmas",
      name: "Christmas season",
      type: "religious_season",
      countries: ["UK", "USA", "UAE", "Egypt", "Jordan"],
      peakStrength: 88,
      recurrence: { kind: "fixed", month: 12, dayStart: 15, dayEnd: 26 },
      relevantCategories: ["fashion", "electronics", "beauty", "food"],
      rationale: "Gift-giving and retail peak in Western and expat markets",
    },
    {
      id: "diwali",
      name: "Diwali",
      type: "religious_season",
      countries: ["UAE", "UK"],
      peakStrength: 76,
      recurrence: { kind: "fixed", month: 11, dayStart: 1, dayEnd: 5 },
      dateRanges: [{ start: "2026-10-20", end: "2026-10-25" }],
      relevantCategories: ["fashion", "beauty", "food", "electronics"],
      rationale: "South Asian diaspora drives gifting and gold/jewellery purchases",
    },
    {
      id: "chinese-new-year",
      name: "Chinese New Year",
      type: "religious_season",
      countries: ["UAE", "UK", "USA"],
      peakStrength: 68,
      recurrence: { kind: "fixed", month: 2, dayStart: 1, dayEnd: 15 },
      dateRanges: [{ start: "2026-02-17", end: "2026-02-22" }],
      relevantCategories: ["travel", "food", "fashion"],
      rationale: "Travel and luxury gifting among Chinese diaspora and tourists",
    },
  ];
}

function nationalEvents(): MarketEvent[] {
  return [
    {
      id: "uae-national-day",
      name: "UAE National Day",
      type: "national_event",
      countries: ["UAE"],
      peakStrength: 80,
      recurrence: { kind: "fixed", month: 12, dayStart: 1, dayEnd: 3 },
      relevantCategories: ["fashion", "telecom", "travel"],
      rationale: "Patriotic campaigns and retail promotions align with national celebration",
    },
    {
      id: "ksa-founding-day",
      name: "Saudi Founding Day",
      type: "national_event",
      countries: ["Saudi Arabia"],
      peakStrength: 78,
      recurrence: { kind: "fixed", month: 2, dayStart: 22, dayEnd: 22 },
      relevantCategories: ["fashion", "food", "telecom"],
      rationale: "National pride moments drive branded content engagement",
    },
    {
      id: "ksa-national-day",
      name: "Saudi National Day",
      type: "national_event",
      countries: ["Saudi Arabia"],
      peakStrength: 85,
      recurrence: { kind: "fixed", month: 9, dayStart: 23, dayEnd: 23 },
      relevantCategories: ["fashion", "telecom", "travel"],
      rationale: "Peak cultural relevance for KSA-targeted campaigns",
    },
    {
      id: "egypt-revolution-day",
      name: "Egypt national holidays",
      type: "national_event",
      countries: ["Egypt"],
      peakStrength: 65,
      recurrence: { kind: "fixed", month: 7, dayStart: 23, dayEnd: 23 },
      relevantCategories: ["food", "telecom", "fashion"],
      rationale: "Public holiday — increased social media consumption",
    },
    {
      id: "turkey-republic-day",
      name: "Republic Day",
      type: "national_event",
      countries: ["Turkey"],
      peakStrength: 70,
      recurrence: { kind: "fixed", month: 10, dayStart: 29, dayEnd: 29 },
      relevantCategories: ["fashion", "travel", "food"],
      rationale: "National celebration boosts local brand affinity content",
    },
    {
      id: "uk-bank-holiday-spring",
      name: "UK Spring bank holiday",
      type: "public_holiday",
      countries: ["UK"],
      peakStrength: 62,
      recurrence: { kind: "fixed", month: 5, dayStart: 25, dayEnd: 25 },
      relevantCategories: ["travel", "food", "fashion"],
      rationale: "Long weekend increases leisure browsing and travel intent",
    },
    {
      id: "usa-independence-day",
      name: "Independence Day",
      type: "national_event",
      countries: ["USA"],
      peakStrength: 75,
      recurrence: { kind: "fixed", month: 7, dayStart: 3, dayEnd: 5 },
      relevantCategories: ["food", "fashion", "electronics"],
      rationale: "Summer holiday retail and outdoor lifestyle content peaks",
    },
  ];
}

function seasonalEvents(): MarketEvent[] {
  return [
    {
      id: "gcc-summer-travel",
      name: "GCC summer travel season",
      type: "seasonal_behaviour",
      countries: GCC,
      peakStrength: 74,
      recurrence: { kind: "season", hemisphere: "northern", season: "summer" },
      relevantCategories: ["travel", "fashion", "beauty"],
      rationale: "Residents travel abroad — aspirational destination content performs strongly",
    },
    {
      id: "gcc-winter-outdoor",
      name: "GCC outdoor winter season",
      type: "weather_season",
      countries: GCC,
      peakStrength: 70,
      recurrence: { kind: "season", hemisphere: "northern", season: "winter" },
      relevantCategories: ["food", "fashion", "travel", "telecom"],
      rationale: "Pleasant weather drives outdoor events, dining, and mall visits",
    },
    {
      id: "uk-winter-retail",
      name: "UK winter retail peak",
      type: "seasonal_behaviour",
      countries: ["UK"],
      peakStrength: 72,
      recurrence: { kind: "season", hemisphere: "northern", season: "winter" },
      relevantCategories: ["fashion", "electronics", "beauty"],
      rationale: "Holiday gifting and indoor shopping season",
    },
  ];
}

function sportsEvents(): MarketEvent[] {
  return [
    {
      id: "football-tournament",
      name: "Major football tournament windows",
      type: "sports_event",
      countries: [...MENA, "UK", "Turkey"],
      peakStrength: 68,
      recurrence: { kind: "fixed", month: 6, dayStart: 10, dayEnd: 30 },
      dateRanges: [{ start: "2026-06-10", end: "2026-07-15" }],
      relevantCategories: ["food", "telecom", "fashion"],
      rationale: "Live sports drive concurrent social viewing and F&B delivery peaks",
    },
  ];
}

/** Full market calendar — merge country packs as the engine grows. */
export const MARKET_CALENDAR_EVENTS: MarketEvent[] = [
  ...salaryEvents(MENA),
  ...salaryEvents(["UK", "USA"]),
  ...retailEvents(),
  ...religiousEvents(),
  ...nationalEvents(),
  ...seasonalEvents(),
  ...sportsEvents(),
];

export function eventsForCountry(country: MarketCountry): MarketEvent[] {
  return MARKET_CALENDAR_EVENTS.filter((event) => event.countries.includes(country));
}

export function eventsByType(type: MarketEventType): MarketEvent[] {
  return MARKET_CALENDAR_EVENTS.filter((event) => event.type === type);
}

export const SUPPORTED_MARKET_COUNTRIES: MarketCountry[] = [
  "UAE",
  "Saudi Arabia",
  "Egypt",
  "Kuwait",
  "Qatar",
  "Bahrain",
  "Oman",
  "Jordan",
  "Morocco",
  "Turkey",
  "UK",
  "USA",
];

/** ISO-2 codes from campaign facts → canonical MarketCountry labels. */
const ISO_TO_MARKET_COUNTRY: Record<string, MarketCountry> = {
  AE: "UAE",
  SA: "Saudi Arabia",
  EG: "Egypt",
  KW: "Kuwait",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
  JO: "Jordan",
  MA: "Morocco",
  TR: "Turkey",
  GB: "UK",
  US: "USA",
};

/** Map campaign geography strings to canonical MarketCountry codes. */
export function resolveMarketCountryFromLabel(label: string): MarketCountry | undefined {
  const trimmed = label.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  const aliases: Record<string, MarketCountry> = {
    uae: "UAE",
    "united arab emirates": "UAE",
    dubai: "UAE",
    "abu dhabi": "UAE",
    ksa: "Saudi Arabia",
    "saudi arabia": "Saudi Arabia",
    saudi: "Saudi Arabia",
    egypt: "Egypt",
    kuwait: "Kuwait",
    qatar: "Qatar",
    bahrain: "Bahrain",
    oman: "Oman",
    jordan: "Jordan",
    morocco: "Morocco",
    turkey: "Turkey",
    uk: "UK",
    "united kingdom": "UK",
    britain: "UK",
    usa: "USA",
    "united states": "USA",
    us: "USA",
  };
  if (aliases[lower]) return aliases[lower];

  const byExact = SUPPORTED_MARKET_COUNTRIES.find((country) => country.toLowerCase() === lower);
  if (byExact) return byExact;

  const isoCode = resolveCountryCode(trimmed);
  return isoCode ? ISO_TO_MARKET_COUNTRY[isoCode] : undefined;
}

/** Expand regional labels (MENA, GCC) into constituent countries. */
export function expandRegionalGeography(regions: string[]): MarketCountry[] {
  const countries = new Set<MarketCountry>();
  for (const region of regions) {
    const lower = region.trim().toLowerCase();
    if (lower === "gcc") {
      for (const c of GCC) countries.add(c);
      continue;
    }
    if (lower === "mena") {
      for (const c of MENA) countries.add(c);
      continue;
    }
    const resolved = resolveMarketCountryFromLabel(region);
    if (resolved) countries.add(resolved);
  }
  return [...countries];
}
