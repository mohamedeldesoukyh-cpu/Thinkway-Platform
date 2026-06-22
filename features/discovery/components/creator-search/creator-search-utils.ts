import type { UnifiedCreatorResult } from "@/lib/creators/types";

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
      esc(p?.profile_url ?? ""),
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export {
  CREATOR_COMPARE_STORAGE_KEY as CREATOR_SEARCH_COMPARE_KEY,
  stashCompareQueue,
} from "@/features/discovery/components/creator-compare/compare-storage";
