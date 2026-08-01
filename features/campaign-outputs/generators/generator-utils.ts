/**
 * Shared, deterministic helpers for Campaign Output generators — service-type
 * recommendation, tier ranking, money formatting, KPI-target parsing, and
 * platform benchmarks. Pure and dependency-light so every generator stays
 * reproducible.
 */

import { formatMoneyKpi } from "@/lib/finance/currency-format";

export const TIER_PRIORITY: Record<string, number> = {
  celebrity: 0,
  mega: 0,
  macro: 1,
  "mid-tier": 2,
  mid: 2,
  micro: 3,
  nano: 4,
};

export function tierRank(tier?: string): number {
  if (!tier) return 5;
  return TIER_PRIORITY[tier.trim().toLowerCase()] ?? 5;
}

/** Normalize a platform label to a lookup key. */
function platformKey(platform: string): "tiktok" | "instagram" | "youtube" | "other" {
  const p = platform.toLowerCase();
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("insta") || p === "ig") return "instagram";
  if (p.includes("youtube") || p === "yt") return "youtube";
  return "other";
}

/**
 * Recommend the content service type(s) for a creator on a platform, based on
 * tier — the Director's "which service should be used" call. Higher tiers lead
 * with premium video; lower tiers carry frequency and UGC.
 */
export function recommendServices(tier: string | undefined, platform: string): string[] {
  const rank = tierRank(tier);
  const key = platformKey(platform);
  const reel = key === "tiktok" ? "TikTok Reel" : key === "youtube" ? "YouTube Integration" : "Instagram Reel";
  const story = key === "tiktok" ? "TikTok Story" : "Instagram Story";
  const spark = key === "tiktok" ? "Spark Ads" : "Boosted Post";

  if (rank <= 1) return [reel, spark]; // Celebrity / Macro — premium video + paid amplification
  if (rank === 2) return [reel, "Carousel"]; // Mid-tier — video + carousel
  if (rank === 3) return [story, "Static Post"]; // Micro — frequency
  return ["UGC", story]; // Nano — authentic UGC
}

export function primaryService(tier: string | undefined, platform: string): string {
  return recommendServices(tier, platform)[0]!;
}

export function formatMoney(amount: number, currency: string): string {
  return formatMoneyKpi(amount, currency);
}

/** Blended benchmarks per platform (nominal, in the budget's currency for CPM). */
export const PLATFORM_BENCHMARKS: Record<
  "tiktok" | "instagram" | "youtube" | "other",
  { cpm: number; engagementRate: number; reachFactor: number }
> = {
  tiktok: { cpm: 90, engagementRate: 0.055, reachFactor: 0.62 },
  instagram: { cpm: 120, engagementRate: 0.032, reachFactor: 0.58 },
  youtube: { cpm: 200, engagementRate: 0.018, reachFactor: 0.5 },
  other: { cpm: 150, engagementRate: 0.03, reachFactor: 0.55 },
};

export function benchmarkFor(platform: string) {
  return PLATFORM_BENCHMARKS[platformKey(platform)];
}

export type KpiTarget = {
  label: string;
  metric: "reach" | "impressions" | "engagement" | "engagement_rate" | "views" | "conversions" | "other";
  value: number;
  isPercent: boolean;
};

const MAGNITUDES: Record<string, number> = {
  k: 1_000,
  m: 1_000_000,
  mn: 1_000_000,
  bn: 1_000_000_000,
};

/** Parse KPI target strings like "10M reach", "4% engagement", "500k views". */
export function parseKpiTargets(kpis: string[]): KpiTarget[] {
  return kpis.map((raw) => {
    const text = raw.trim();
    const numMatch = text.match(/([\d][\d,.]*)\s*(k|m|mn|bn)?/i);
    const isPercent = /%/.test(text);
    let value = 0;
    if (numMatch) {
      const base = Number(numMatch[1]!.replace(/,/g, ""));
      const mag = numMatch[2] ? (MAGNITUDES[numMatch[2].toLowerCase()] ?? 1) : 1;
      if (Number.isFinite(base)) value = base * mag;
    }
    const lower = text.toLowerCase();
    const metric: KpiTarget["metric"] = /reach/.test(lower)
      ? "reach"
      : /impression/.test(lower)
        ? "impressions"
        : /engagement\s*rate|%/.test(lower)
          ? "engagement_rate"
          : /engagement/.test(lower)
            ? "engagement"
            : /view/.test(lower)
              ? "views"
              : /conversion|sale|lead/.test(lower)
                ? "conversions"
                : "other";
    return { label: text, metric, value, isPercent };
  });
}

/** Group a slate's tiers into counts, for allocation & activation logic. */
export function tierCounts(slate: Array<{ tier?: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const c of slate) {
    const tier = c.tier?.trim() || "Unclassified";
    counts[tier] = (counts[tier] ?? 0) + 1;
  }
  return counts;
}
