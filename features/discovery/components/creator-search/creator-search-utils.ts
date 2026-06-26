import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";

import type { CreatorSearchSort } from "./creator-search-types";

/** Converts an ISO 3166-1 alpha-2 code (e.g. "AE") to its flag emoji. */
export function countryFlag(code: string | null | undefined): string | null {
  if (!code) return null;
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length !== 2 || !/^[A-Z]{2}$/.test(trimmed)) return null;
  const base = 127397; // 0x1F1E6 - 'A'.codePointAt(0)
  return String.fromCodePoint(
    base + trimmed.charCodeAt(0),
    base + trimmed.charCodeAt(1)
  );
}

/** Distinct audience-interest / category tags for a creator. */
export function audienceInterestList(creator: UnifiedCreatorResult): string[] {
  const parts = [creator.ai_category, creator.ai_niche, ...creator.categories]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(parts.map((value) => value.toLowerCase()))]
    .map((lower) => parts.find((value) => value.toLowerCase() === lower) ?? lower);
}

const SORT_VALUE: Record<
  Exclude<CreatorSearchSort, "name">,
  (creator: UnifiedCreatorResult) => number
> = {
  relevance: (c) => thinkwayAiScore(c) ?? 0,
  followers: (c) => c.metrics.followers.value ?? 0,
  engagement: (c) => c.metrics.engagement_rate.value ?? 0,
  views: (c) => c.metrics.avg_views.value ?? 0,
};

/** Stable client-side sort applied on top of the server result set. */
export function sortCreators(
  creators: UnifiedCreatorResult[],
  sort: CreatorSearchSort
): UnifiedCreatorResult[] {
  const next = [...creators];
  if (sort === "name") {
    next.sort((a, b) => a.display_name.localeCompare(b.display_name));
    return next;
  }
  const getValue = SORT_VALUE[sort];
  next.sort((a, b) => getValue(b) - getValue(a));
  return next;
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
  const primary = creator.platforms[0];
  const code = primary?.audience_country ?? creator.estimated_country ?? creator.country_code;
  return code ?? "—";
}

export function categoriesLabel(creator: UnifiedCreatorResult): string {
  const parts = [
    creator.ai_category,
    creator.ai_niche,
    ...creator.categories.slice(0, 2),
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

export function estimatedPricingLabel(_creator: UnifiedCreatorResult): string {
  return "—";
}

export function thinkwayAiScore(creator: UnifiedCreatorResult): number | null {
  return creator.thinkway_score ?? creator.brand_fit_score ?? null;
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
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [
      esc(c.display_name),
      esc(p?.handle ? `@${p.handle.replace(/^@/, "")}` : ""),
      esc(p?.platform ?? ""),
      String(c.metrics.followers.value ?? ""),
      String(c.metrics.engagement_rate.value ?? ""),
      String(c.metrics.avg_views.value ?? ""),
      esc(c.country_code ?? ""),
      esc(audienceCountryLabel(c)),
      esc(categoriesLabel(c)),
      String(thinkwayAiScore(c) ?? ""),
      String(c.authenticity_score ?? ""),
      esc(resolveCreatorProfileUrl(p) ?? ""),
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export {
  CREATOR_COMPARE_STORAGE_KEY as CREATOR_SEARCH_COMPARE_KEY,
  stashCompareQueue,
} from "@/features/discovery/components/creator-compare/compare-storage";
