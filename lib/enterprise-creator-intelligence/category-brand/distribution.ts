import type {
  AnalysisWindowKey,
  CategoryBrandConfidence,
  CategoryBrandSource,
  CategoryShare,
  CategoryTrendLabel,
  ContentMixShare,
  ContentMixType,
  IndustryShare,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";
import { windowDaySpan } from "@/lib/enterprise-creator-intelligence/category-brand/windows";
import { industryFromCategory } from "@/lib/enterprise-creator-intelligence/category-brand/classify";

/** Normalize raw counts so percentages total exactly 100. */
export function normalizeToHundred(
  counts: Map<string, number>
): Array<{ key: string; count: number; percent: number }> {
  const entries = [...counts.entries()].filter(([, count]) => count > 0);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total <= 0) return [];

  const raw = entries.map(([key, count]) => ({
    key,
    count,
    exact: (count / total) * 100,
  }));

  const floored = raw.map((row) => ({
    ...row,
    percent: Math.floor(row.exact),
    fraction: row.exact - Math.floor(row.exact),
  }));

  let remainder = 100 - floored.reduce((sum, row) => sum + row.percent, 0);
  floored
    .sort((a, b) => b.fraction - a.fraction)
    .forEach((row) => {
      if (remainder <= 0) return;
      row.percent += 1;
      remainder -= 1;
    });

  return floored
    .map(({ key, count, percent }) => ({ key, count, percent }))
    .sort((a, b) => b.percent - a.percent || a.key.localeCompare(b.key));
}

export function buildCategoryConfidence(
  postCount: number,
  window: AnalysisWindowKey
): CategoryBrandConfidence {
  const days = windowDaySpan(window);
  const basedOn = [
    { label: "analysed posts", value: postCount },
    { label: "days", value: days },
  ];
  const postScore = Math.min(postCount / 180, 1) * 70;
  const windowScore = Math.min(days / 180, 1) * 30;
  const percent = Math.round(Math.max(0, Math.min(100, postScore + windowScore)));
  return {
    percent,
    reason: `Based on ${postCount} analysed posts, ${days} days.`,
    basedOn,
  };
}

export function classifyCategoryTrend(
  currentPercent: number,
  priorPercent: number | null,
  postCount: number
): CategoryTrendLabel {
  if (priorPercent == null) {
    return currentPercent >= 8 && postCount >= 2 ? "Emerging" : "Unknown";
  }
  const delta = currentPercent - priorPercent;
  if (Math.abs(delta) < 3) return "Stable";
  if (delta >= 3) return currentPercent < 12 && priorPercent < 5 ? "Emerging" : "Increasing";
  return "Declining";
}

export function buildBaseSource(input: {
  platform: string | null;
  window: AnalysisWindowKey | "multi_window";
  confidence: number | null;
  lastRefresh: string | null;
  contentSource?: string;
  analysisMethod?: string;
}): CategoryBrandSource {
  return {
    platform: input.platform,
    contentSource:
      input.contentSource ??
      "influencer_platform_accounts.recent_publications + campaign_publications",
    analysisMethod:
      input.analysisMethod ??
      "Behavioural category inference via Thinkway taxonomy keywords on captions/hashtags/mentions",
    collectionWindow: input.window,
    confidence: input.confidence,
    lastRefresh: input.lastRefresh,
  };
}

export function buildCategoryShares(input: {
  counts: Map<string, number>;
  priorCounts?: Map<string, number> | null;
  window: AnalysisWindowKey;
  platform: string | null;
  analysedPostCount: number;
  lastUpdated: string;
}): CategoryShare[] {
  const normalized = normalizeToHundred(input.counts);
  const priorTotal =
    input.priorCounts == null
      ? 0
      : [...input.priorCounts.values()].reduce((s, n) => s + n, 0);
  const priorPercents = new Map<string, number>();
  if (input.priorCounts && priorTotal > 0) {
    for (const [key, count] of input.priorCounts) {
      priorPercents.set(key, Math.round((count / priorTotal) * 100));
    }
  }

  const confidence = buildCategoryConfidence(
    input.analysedPostCount,
    input.window
  );
  const source = buildBaseSource({
    platform: input.platform,
    window: input.window,
    confidence: confidence.percent,
    lastRefresh: input.lastUpdated,
  });

  return normalized.map((row) => {
    const prior = priorPercents.get(row.key) ?? null;
    const trend = classifyCategoryTrend(row.percent, prior, row.count);
    const whatChanged =
      prior == null
        ? `${row.key} observed at ${row.percent}% in the ${input.window.replace(/_/g, " ")} window.`
        : `${row.key} moved from ${prior}% to ${row.percent}%.`;
    const whyChanged =
      prior == null
        ? `Derived from ${row.count} posts classified via Thinkway category keywords.`
        : `Share of classified posts changed by ${row.percent - prior} percentage points.`;
    const businessImplication =
      trend === "Increasing" || trend === "Emerging"
        ? `${row.key} is becoming more central to this creator's content — relevant for Planning brief fit.`
        : trend === "Declining"
          ? `${row.key} share is falling — verify ongoing category fit before brief commitment.`
          : `${row.key} remains a stable content pillar.`;

    return {
      category: row.key,
      percent: row.percent,
      postCount: row.count,
      confidence,
      trend,
      whatChanged,
      whyChanged,
      historicalTrend: prior == null ? "No prior window comparison." : whatChanged,
      businessImplication,
      source,
      explainability: {
        value: row.percent,
        meaning: `Share of analysed posts classified as ${row.key}.`,
        confidence: confidence.percent,
        evidence: [
          `${row.count} posts`,
          confidence.reason,
          `Window: ${input.window}`,
        ],
        historicalTrend: prior == null ? "Baseline observation." : whatChanged,
        businessContext: businessImplication,
        dataSource: source,
        lastUpdated: input.lastUpdated,
        missingInputs: input.analysedPostCount === 0 ? ["posts"] : [],
      },
    };
  });
}

export function buildContentMixShares(input: {
  counts: Map<ContentMixType, number>;
  window: AnalysisWindowKey;
  platform: string | null;
  analysedPostCount: number;
  lastUpdated: string;
}): ContentMixShare[] {
  const normalized = normalizeToHundred(input.counts as Map<string, number>);
  const confidence = buildCategoryConfidence(
    input.analysedPostCount,
    input.window
  );
  const source = buildBaseSource({
    platform: input.platform,
    window: input.window,
    confidence: confidence.percent,
    lastRefresh: input.lastUpdated,
    analysisMethod:
      "Content-type classification from publication URL/product_type/mediaType/isVideo heuristics",
  });

  return normalized.map((row) => ({
    contentType: row.key as ContentMixType,
    percent: row.percent,
    postCount: row.count,
    confidence,
    source,
    explainability: {
      value: row.percent,
      meaning: `Share of posts classified as ${row.key}.`,
      confidence: confidence.percent,
      evidence: [`${row.count} posts`, confidence.reason],
      historicalTrend: "Content mix snapshot for selected window.",
      businessContext: `${row.key} format share informs deliverable planning.`,
      dataSource: source,
      lastUpdated: input.lastUpdated,
      missingInputs: input.analysedPostCount === 0 ? ["posts"] : [],
    },
  }));
}

export function buildIndustryShares(input: {
  categoryShares: CategoryShare[];
  window: AnalysisWindowKey;
  platform: string | null;
  lastUpdated: string;
}): IndustryShare[] {
  const counts = new Map<string, number>();
  for (const share of input.categoryShares) {
    if (share.category === "Other") continue;
    const industry = industryFromCategory(share.category);
    counts.set(industry, (counts.get(industry) ?? 0) + share.postCount);
  }
  const normalized = normalizeToHundred(counts);
  const confidence = buildCategoryConfidence(
    input.categoryShares.reduce((s, c) => s + c.postCount, 0),
    input.window
  );
  const source = buildBaseSource({
    platform: input.platform,
    window: input.window,
    confidence: confidence.percent,
    lastRefresh: input.lastUpdated,
    analysisMethod: "Industry rollup from behavioural category distribution",
  });

  return normalized.map((row) => {
    const related = input.categoryShares.find(
      (c) => industryFromCategory(c.category) === row.key
    );
    return {
      industry: row.key,
      percent: row.percent,
      mentionOrPostCount: row.count,
      trend: related?.trend ?? "Unknown",
      confidence,
      source,
      explainability: {
        value: row.percent,
        meaning: `Share of creator behavioural content mapped to ${row.key} industry.`,
        confidence: confidence.percent,
        evidence: [`${row.count} classified posts`, confidence.reason],
        historicalTrend: related?.historicalTrend ?? "No prior industry trend.",
        businessContext: `${row.key} industry relevance for commercial briefing.`,
        dataSource: source,
        lastUpdated: input.lastUpdated,
        missingInputs: normalized.length === 0 ? ["category_posts"] : [],
      },
    };
  });
}

export function assertPercentTotal100(shares: Array<{ percent: number }>): boolean {
  if (shares.length === 0) return true;
  return shares.reduce((sum, row) => sum + row.percent, 0) === 100;
}
