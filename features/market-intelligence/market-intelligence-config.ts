/**
 * Resolve per-campaign market intelligence config from Campaign Object meta.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import { expandRegionalGeography } from "./market-calendar-db";
import { resolveMarketIndustryCategory } from "./market-industry-intelligence";
import type { MarketCountry, MarketIntelligenceConfig, MarketIntelligenceToggles } from "./types";
import { DEFAULT_MARKET_INTELLIGENCE_CONFIG, DEFAULT_MARKET_INTELLIGENCE_TOGGLES } from "./types";

export type MediaPlanMarketIntelligenceMeta = {
  enabled?: boolean;
  toggles?: Partial<MarketIntelligenceToggles>;
  countries?: MarketCountry[];
  category?: MarketIntelligenceConfig["category"];
  influenceMultiplier?: number;
};

function mergeToggles(
  base: MarketIntelligenceToggles,
  override?: Partial<MarketIntelligenceToggles>
): MarketIntelligenceToggles {
  if (!override) return { ...base };
  return { ...base, ...override };
}

/** Read market intelligence overrides from campaign meta.mediaPlanSchedule. */
export function marketIntelligenceFromCampaignObject(
  campaignObject: CampaignObject
): MediaPlanMarketIntelligenceMeta | undefined {
  return campaignObject.meta.mediaPlanSchedule?.marketIntelligence;
}

/** Resolve full config with defaults — all toggles enabled unless explicitly disabled. */
export function resolveMarketIntelligenceConfig(
  campaignObject: CampaignObject,
  briefText?: string
): MarketIntelligenceConfig {
  const meta = marketIntelligenceFromCampaignObject(campaignObject);
  const facts = getCampaignFacts(campaignObject);

  const geographyCountries = expandRegionalGeography(facts?.geography ?? []);
  const countries =
    meta?.countries?.length
      ? meta.countries
      : geographyCountries.length
        ? geographyCountries
        : (["UAE"] as MarketCountry[]);

  const category =
    meta?.category ??
    resolveMarketIndustryCategory(
      facts?.industry,
      briefText ?? facts?.objective,
      facts?.brandName
    );

  return {
    enabled: meta?.enabled !== false,
    toggles: mergeToggles(DEFAULT_MARKET_INTELLIGENCE_TOGGLES, meta?.toggles),
    countries,
    category,
    influenceMultiplier: meta?.influenceMultiplier ?? 1,
  };
}

/** Stable fingerprint slice for output staleness and display cache keys. */
export function marketIntelligenceFingerprintValue(
  campaignObject: CampaignObject
): { enabled: boolean; toggles: MarketIntelligenceToggles } {
  const config = resolveMarketIntelligenceConfig(campaignObject);
  return {
    enabled: config.enabled,
    toggles: config.toggles,
  };
}

/** Serialized key for React memoization when MI meta changes. */
export function marketIntelligenceDisplayKey(campaignObject: CampaignObject): string {
  const value = marketIntelligenceFingerprintValue(campaignObject);
  return `${value.enabled}:${JSON.stringify(value.toggles)}`;
}

export { DEFAULT_MARKET_INTELLIGENCE_CONFIG };
