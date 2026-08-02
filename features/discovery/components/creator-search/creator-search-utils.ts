import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { discoveryCreatorCategoriesLabel } from "@/lib/creators/creator-display-categories";
import {
  countryFlag,
  countryFlagImageUrl,
  countryFlagImageFallbackUrls,
  formatCreatorCountryLabels,
  normalizeCountryCode,
} from "@/lib/creators/creator-display-utils";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { csvEscapeRow } from "@/lib/security/csv-formula";

export {
  applyCreatorSearchHeaderSort,
  sortCreators,
} from "./creator-search-sort";

import {
  defaultDirectionForSortField,
  type CreatorSearchSortField,
  type CreatorSearchSortState,
} from "./creator-search-types";

export type { CreatorSearchSortField, CreatorSearchSortState };
export { defaultDirectionForSortField };

export {
  countryFlag,
  countryFlagImageUrl,
  countryFlagImageFallbackUrls,
  formatCreatorCountryLabels,
  normalizeCountryCode,
};

/** Distinct audience-interest / category tags for a creator. */
export function audienceInterestList(creator: UnifiedCreatorResult): string[] {
  const parts = [creator.ai_category, creator.ai_niche, ...creator.categories]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(parts.map((value) => value.toLowerCase()))]
    .map((lower) => parts.find((value) => value.toLowerCase() === lower) ?? lower);
}

/** @deprecated Investment display SSOT is ECI — use discoveryInvestmentScore. */
export function thinkwayAiScore(creator: UnifiedCreatorResult): number | null {
  if (creator.eci_investment_score != null && Number.isFinite(creator.eci_investment_score)) {
    return Math.min(100, Math.max(0, Math.round(creator.eci_investment_score)));
  }
  // Do not fall back to Thinkway / brand_fit as investment SSOT.
  return null;
}

export function formatCreatorCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function formatEngagementRate(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${Number(value).toFixed(2)}%`;
}

export function brandSafetyMeta(score: number | null): {
  label: string;
  className: string;
} {
  if (score == null) return { label: "—", className: "text-[#9099A8]" };
  if (score >= 80) return { label: "High", className: "text-[#1D9E75]" };
  if (score >= 60) return { label: "Med", className: "text-amber-600" };
  return { label: "Review", className: "text-rose-600" };
}

export function audienceCountryLabel(creator: UnifiedCreatorResult): string {
  return formatCreatorCountryLabels(creator);
}

export function categoriesLabel(creator: UnifiedCreatorResult): string {
  return discoveryCreatorCategoriesLabel(creator);
}

export function estimatedPricingLabel(_creator: UnifiedCreatorResult): string {
  return "—";
}

export function exportCreatorsCsv(creators: UnifiedCreatorResult[]): string {
  const header = [
    "Display Name",
    "Username",
    "Platform",
    "Followers",
    "Engagement Rate",
    "Avg Views",
    "Country",
    "Audience Country",
    "Categories",
    "Thinkway AI Score",
    "Brand Safety",
    "Profile URL",
  ];
  const rows = creators.map((c) => {
    const p = c.platforms[0];
    return csvEscapeRow([
      c.display_name,
      p?.handle ? `@${p.handle.replace(/^@/, "")}` : "",
      p?.platform ?? "",
      c.metrics.followers.value ?? "",
      c.metrics.engagement_rate.value ?? "",
      c.metrics.avg_views.value ?? "",
      formatCreatorCountryLabels(c),
      audienceCountryLabel(c),
      categoriesLabel(c),
      thinkwayAiScore(c) ?? "",
      c.authenticity_score ?? "",
      resolveCreatorProfileUrl(p) ?? "",
    ]);
  });
  return [header.map((h) => `"${h}"`).join(","), ...rows].join("\n");
}

export {
  CREATOR_COMPARE_STORAGE_KEY as CREATOR_SEARCH_COMPARE_KEY,
  stashCompareQueue,
} from "@/features/discovery/components/creator-compare/compare-storage";
