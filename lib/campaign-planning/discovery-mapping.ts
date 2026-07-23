import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import { TIER_FILTER_RANGES } from "@/lib/creators/influencer-tier";

import type {
  AudienceStrategy,
  CampaignPlanningInput,
  CreatorMixStrategy,
  DiscoveryBrief,
  PlatformStrategy,
} from "./types";

function countryCodeFromGeography(geo: string): string | null {
  const text = geo.toLowerCase();
  if (text.includes("egypt") || text === "eg") return "EG";
  if (text.includes("uae") || text.includes("emirates")) return "AE";
  if (text.includes("saudi")) return "SA";
  if (text.includes("kuwait")) return "KW";
  if (text.includes("qatar")) return "QA";
  if (text.length === 2) return geo.toUpperCase();
  return null;
}

function addFilter(
  filters: DiscoveryMappedFilter[],
  key: DiscoveryMappedFilter["key"],
  label: string,
  value: string,
  confidence: number
) {
  if (confidence < 0.55) return;
  filters.push({
    id: `${key}:${value}`,
    key,
    label,
    value,
    weight: 80,
    confidence,
  });
}

export function buildDiscoveryBrief(input: {
  planning: CampaignPlanningInput;
  creatorMix: CreatorMixStrategy;
  platformStrategy: PlatformStrategy;
  audienceStrategy: AudienceStrategy;
}): DiscoveryBrief {
  const filters: DiscoveryMappedFilter[] = [];
  const skippedFields: string[] = [];

  for (const geo of input.planning.brief.geography ?? []) {
    const code = countryCodeFromGeography(geo);
    if (code) {
      addFilter(filters, "audience_country", "Audience Country", code, 0.9);
      addFilter(filters, "creator_country", "Creator Country", code, 0.85);
    } else {
      skippedFields.push(`geography:${geo}`);
    }
  }

  for (const platform of input.platformStrategy.platforms) {
    addFilter(filters, "platform", "Platform", platform.platform, 0.88);
  }

  for (const segment of input.audienceStrategy.segments) {
    for (const lang of segment.language ?? []) {
      addFilter(filters, "language", "Language", lang, 0.8);
    }
    for (const interest of segment.interests ?? []) {
      addFilter(filters, "category", "Category", interest, 0.75);
    }
    if (segment.gender) {
      addFilter(filters, "audience_gender", "Audience Gender", segment.gender, 0.7);
    }
    if (segment.ageRange) {
      const [min, max] = segment.ageRange.split("-").map((v) => Number(v));
      if (Number.isFinite(min)) addFilter(filters, "audience_age_min", "Audience Age Min", String(min), 0.65);
      if (Number.isFinite(max)) addFilter(filters, "audience_age_max", "Audience Age Max", String(max), 0.65);
    }
  }

  const tierMix = input.creatorMix.tiers.map((tier) => ({
    tier: tier.tier,
    percent: tier.percent,
  }));

  const dominantTier = [...input.creatorMix.tiers].sort((a, b) => b.percent - a.percent)[0];
  if (dominantTier) {
    const range = TIER_FILTER_RANGES.find((entry) => entry.tier === dominantTier.tier);
    if (range) {
      addFilter(filters, "follower_min", "Follower Min", String(range.min), 0.72);
      if (range.max != null) addFilter(filters, "follower_max", "Follower Max", String(range.max), 0.72);
    }
  }

  const engagementThresholdMin =
    (input.planning.brief.objective ?? "").toLowerCase().includes("engagement") ? 3.5 : 2.0;
  addFilter(filters, "engagement_min", "Engagement Min", String(engagementThresholdMin), 0.68);

  if (!input.planning.brief.budget?.amount) skippedFields.push("budget");
  if (!input.planning.brief.durationWeeks) skippedFields.push("durationWeeks");

  return {
    mappedFilters: filters,
    tierMix,
    engagementThresholdMin,
    summary: `${filters.length} Discovery filters from strategy (${tierMix.length} tier targets, ${input.platformStrategy.platforms.length} platforms).`,
    skippedFields,
  };
}

export function discoveryBriefToCreatorFilterSummary(brief: DiscoveryBrief): string[] {
  return brief.mappedFilters.map((filter) => `${filter.label}: ${filter.value} (${Math.round(filter.confidence * 100)}% confidence)`);
}
