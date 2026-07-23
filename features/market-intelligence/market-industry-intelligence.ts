/**
 * Industry → market event type relevance for purchase-cycle scoring.
 */

import type { MarketEventType, MarketIndustryCategory } from "./types";

type IndustryEventAffinity = {
  eventTypes: MarketEventType[];
  /** Multiplier applied when event type matches category (default relevance = 1). */
  boost: number;
};

const INDUSTRY_EVENT_MAP: Record<MarketIndustryCategory, IndustryEventAffinity[]> = {
  food: [
    { eventTypes: ["salary_period", "religious_season", "retail_season"], boost: 1.25 },
    { eventTypes: ["national_event", "sports_event"], boost: 1.1 },
  ],
  fashion: [
    { eventTypes: ["retail_season", "shopping_peak", "salary_period"], boost: 1.3 },
    { eventTypes: ["religious_season", "school_calendar", "seasonal_behaviour"], boost: 1.15 },
  ],
  electronics: [
    { eventTypes: ["retail_season", "shopping_peak"], boost: 1.35 },
    { eventTypes: ["salary_period"], boost: 1.2 },
  ],
  travel: [
    { eventTypes: ["seasonal_behaviour", "weather_season", "national_event"], boost: 1.3 },
    { eventTypes: ["religious_season", "public_holiday"], boost: 1.15 },
  ],
  beauty: [
    { eventTypes: ["retail_season", "salary_period", "religious_season"], boost: 1.25 },
    { eventTypes: ["school_calendar"], boost: 1.1 },
  ],
  telecom: [
    { eventTypes: ["national_event", "sports_event", "shopping_peak"], boost: 1.2 },
    { eventTypes: ["salary_period"], boost: 1.1 },
  ],
  finance: [
    { eventTypes: ["salary_period", "national_event"], boost: 1.15 },
  ],
  general: [
    { eventTypes: ["salary_period", "retail_season", "national_event"], boost: 1.0 },
  ],
};

/** Category boost for an event type — 1.0 when no specific affinity. */
export function industryBoostForEventType(
  category: MarketIndustryCategory,
  eventType: MarketEventType
): number {
  const affinities = INDUSTRY_EVENT_MAP[category] ?? INDUSTRY_EVENT_MAP.general;
  let boost = 1;
  for (const affinity of affinities) {
    if (affinity.eventTypes.includes(eventType)) {
      boost = Math.max(boost, affinity.boost);
    }
  }
  return boost;
}

/** Parse campaign industry/facts/brief into market category. */
export function resolveMarketIndustryCategory(
  industry?: string,
  briefText?: string,
  brandName?: string
): MarketIndustryCategory {
  const combined = `${industry ?? ""} ${briefText ?? ""} ${brandName ?? ""}`.toLowerCase();
  if (
    /\b(food|fmcg|cpg|consumer goods|beverage|restaurant|grocery|snack|tuna|seafood|fish|dairy|packaged goods)\b/.test(
      combined
    )
  ) {
    return "food";
  }
  if (/\b(fashion|apparel|retail|sportswear|sneaker|clothing)\b/.test(combined)) return "fashion";
  if (/\b(electronic|gadget|tech|mobile|device|appliance)\b/.test(combined)) return "electronics";
  if (/\b(travel|tourism|hotel|airline|destination)\b/.test(combined)) return "travel";
  if (/\b(beauty|cosmetic|skincare|makeup|fragrance)\b/.test(combined)) return "beauty";
  if (/\b(telecom|telco|5g|mobile network)\b/.test(combined)) return "telecom";
  if (/\b(bank|finance|fintech|insurance)\b/.test(combined)) return "finance";
  return "general";
}
