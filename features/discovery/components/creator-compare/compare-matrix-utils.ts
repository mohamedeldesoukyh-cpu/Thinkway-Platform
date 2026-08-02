import type { CreatorCompareBundle } from "@/lib/creators/creator-compare-bundle";
import { formatGrowthRate } from "@/lib/creators/creator-compare-bundle";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  audienceCountryLabel,
  brandSafetyMeta,
  categoriesLabel,
  formatCreatorCount,
  formatEngagementRate,
  thinkwayAiScore,
} from "../creator-search/creator-search-utils";

export type CompareMetricRow = {
  id: string;
  label: string;
  cells: string[];
  numericValues: (number | null)[];
  higherIsBetter: boolean;
};

function bestIndexes(values: (number | null)[], higherIsBetter: boolean): Set<number> {
  const valid = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v != null && !Number.isNaN(x.v));
  if (valid.length < 2) return new Set();
  const target = higherIsBetter
    ? Math.max(...valid.map((x) => x.v))
    : Math.min(...valid.map((x) => x.v));
  return new Set(valid.filter((x) => x.v === target).map((x) => x.i));
}

export function buildCompareMetricRows(bundle: CreatorCompareBundle): CompareMetricRow[] {
  const entries = bundle.entries;

  const defs: Array<{
    id: string;
    label: string;
    cells: string[];
    numericValues: (number | null)[];
    higherIsBetter: boolean;
  }> = [
    {
      id: "followers",
      label: "Followers",
      cells: entries.map((e) => formatCreatorCount(e.creator.metrics.followers.value)),
      numericValues: entries.map((e) => e.creator.metrics.followers.value),
      higherIsBetter: true,
    },
    {
      id: "engagement",
      label: "Engagement Rate",
      cells: entries.map((e) => formatEngagementRate(e.creator.metrics.engagement_rate.value)),
      numericValues: entries.map((e) => e.creator.metrics.engagement_rate.value),
      higherIsBetter: true,
    },
    {
      id: "avg_views",
      label: "Average Views",
      cells: entries.map((e) => formatCreatorCount(e.creator.metrics.avg_views.value)),
      numericValues: entries.map((e) => e.creator.metrics.avg_views.value),
      higherIsBetter: true,
    },
    {
      id: "audience_country",
      label: "Audience Country",
      cells: entries.map((e) => audienceCountryLabel(e.creator)),
      numericValues: entries.map(() => null),
      higherIsBetter: true,
    },
    {
      id: "audience_gender",
      label: "Audience Gender",
      cells: entries.map((e) => e.enrichment.audience_gender),
      numericValues: entries.map(() => null),
      higherIsBetter: true,
    },
    {
      id: "audience_age",
      label: "Audience Age",
      cells: entries.map((e) => e.enrichment.audience_age),
      numericValues: entries.map(() => null),
      higherIsBetter: true,
    },
    {
      id: "categories",
      label: "Categories",
      cells: entries.map((e) => categoriesLabel(e.creator)),
      numericValues: entries.map(() => null),
      higherIsBetter: true,
    },
    {
      id: "brand_safety",
      label: "Brand Safety",
      cells: entries.map((e) => brandSafetyMeta(e.creator.authenticity_score).label),
      numericValues: entries.map((e) => e.creator.authenticity_score),
      higherIsBetter: true,
    },
    {
      id: "ai_score",
      label: "Investment Score",
      cells: entries.map((e) => {
        const score = thinkwayAiScore(e.creator);
        return score != null ? String(Math.round(score)) : "—";
      }),
      numericValues: entries.map((e) => thinkwayAiScore(e.creator)),
      higherIsBetter: true,
    },
    {
      id: "estimated_pricing",
      label: "Estimated Pricing",
      cells: entries.map((e) => e.enrichment.estimated_pricing),
      numericValues: entries.map(() => null),
      higherIsBetter: false,
    },
    {
      id: "collaborations",
      label: "Previous Collaborations",
      cells: entries.map((e) => String(e.enrichment.previous_collaborations)),
      numericValues: entries.map((e) => e.enrichment.previous_collaborations),
      higherIsBetter: true,
    },
    {
      id: "growth_rate",
      label: "Growth Rate",
      cells: entries.map((e) => formatGrowthRate(e.enrichment.growth_rate_percent)),
      numericValues: entries.map((e) => e.enrichment.growth_rate_percent),
      higherIsBetter: true,
    },
  ];

  return defs;
}

export function getBestIndexesForRow(row: CompareMetricRow): Set<number> {
  if (row.numericValues.every((v) => v == null)) return new Set();
  return bestIndexes(row.numericValues, row.higherIsBetter);
}

export function creatorHandle(creator: UnifiedCreatorResult): string {
  const p = creator.platforms[0];
  return p?.handle ? `@${p.handle.replace(/^@/, "")}` : "—";
}
