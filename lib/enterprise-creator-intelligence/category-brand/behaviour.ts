import {
  buildBaseSource,
  buildCategoryConfidence,
} from "@/lib/enterprise-creator-intelligence/category-brand/distribution";
import type {
  CategoryShare,
  ContentConsistencyInsight,
  ContentConsistencyLevel,
  SpecialisationInsight,
  SpecialisationLevel,
  WindowCategoryBundle,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";

export function computeContentConsistency(input: {
  windows: WindowCategoryBundle[];
  platform: string | null;
  lastUpdated: string;
}): ContentConsistencyInsight {
  const lifetime = input.windows.find((w) => w.window === "lifetime");
  const short = input.windows.find((w) => w.window === "last_30_days");
  const mid = input.windows.find((w) => w.window === "last_90_days");

  const top = (bundle?: WindowCategoryBundle) =>
    bundle?.categories.find((c) => c.category !== "Other")?.category ?? null;

  const tops = [top(lifetime), top(mid), top(short)].filter(Boolean);
  const uniqueTops = new Set(tops);
  const categoryCount = lifetime?.categories.filter((c) => c.category !== "Other").length ?? 0;

  let level: ContentConsistencyLevel = "Mixed";
  if (lifetime == null || lifetime.analysedPostCount === 0) {
    level = "Mixed";
  } else if (uniqueTops.size <= 1 && categoryCount <= 2) {
    level = "Highly Consistent";
  } else if (uniqueTops.size <= 2 && categoryCount <= 3) {
    level = "Generally Consistent";
  } else if (uniqueTops.size >= 3 && categoryCount >= 5) {
    level = "Highly Volatile";
  } else if (uniqueTops.size >= 3) {
    level = "Frequently Changing";
  }

  const confidence = buildCategoryConfidence(
    lifetime?.analysedPostCount ?? 0,
    "lifetime"
  );
  const source = buildBaseSource({
    platform: input.platform,
    window: "multi_window",
    confidence: confidence.percent,
    lastRefresh: input.lastUpdated,
    analysisMethod: "Compare primary categories across 30/90/lifetime windows",
  });

  const meaning = `Content consistency is ${level}.`;
  return {
    level,
    meaning,
    confidence,
    explainability: {
      value: level,
      meaning,
      confidence: confidence.percent,
      evidence: [
        `Primary categories across windows: ${[...uniqueTops].join(", ") || "none"}`,
        `Lifetime non-Other categories: ${categoryCount}`,
      ],
      historicalTrend: "Consistency derived from cross-window category stability.",
      businessContext:
        "Behavioural consistency helps Planning judge category risk — not a quality score.",
      dataSource: source,
      lastUpdated: input.lastUpdated,
      missingInputs:
        (lifetime?.analysedPostCount ?? 0) === 0 ? ["posts"] : [],
    },
  };
}

export function computeSpecialisation(input: {
  categories: CategoryShare[];
  emergingCategories: string[];
  platform: string | null;
  lastUpdated: string;
  analysedPostCount: number;
}): SpecialisationInsight {
  const ranked = input.categories.filter((c) => c.category !== "Other");
  const top = ranked[0];
  const topShare = top?.percent ?? 0;
  const activeCount = ranked.filter((c) => c.percent >= 8).length;

  let level: SpecialisationLevel = "Balanced";
  let why = "Category share is distributed without a dominant specialisation.";

  if (input.emergingCategories.length > 0 && topShare < 40) {
    level = "Emerging Category Shift";
    why = `Emerging/increasing categories detected: ${input.emergingCategories.join(", ")}.`;
  } else if (topShare >= 55 && activeCount <= 2) {
    level = "Highly Specialised";
    why = `${top?.category ?? "Primary"} holds ${topShare}% of behavioural content.`;
  } else if (activeCount >= 5) {
    level = "Multi-category";
    why = `${activeCount} categories each hold at least 8% share.`;
  } else if (topShare < 30 && activeCount >= 3) {
    level = "Generalist";
    why = "No category exceeds a strong specialisation threshold.";
  } else if (topShare >= 35 && activeCount <= 3) {
    level = "Balanced";
    why = `${top?.category ?? "Primary"} leads with supporting secondary categories.`;
  }

  const confidence = buildCategoryConfidence(
    input.analysedPostCount,
    "lifetime"
  );
  const source = buildBaseSource({
    platform: input.platform,
    window: "lifetime",
    confidence: confidence.percent,
    lastRefresh: input.lastUpdated,
    analysisMethod: "Specialisation from category concentration and emerging shifts",
  });

  return {
    level,
    meaning: `Creator focus is ${level}.`,
    why,
    confidence,
    explainability: {
      value: level,
      meaning: `Creator focus is ${level}.`,
      confidence: confidence.percent,
      evidence: [why, `Active categories (≥8%): ${activeCount}`],
      historicalTrend: input.emergingCategories.length
        ? `Emerging shift: ${input.emergingCategories.join(", ")}`
        : "No emerging shift detected.",
      businessContext: why,
      dataSource: source,
      lastUpdated: input.lastUpdated,
      missingInputs: input.analysedPostCount === 0 ? ["posts"] : [],
    },
  };
}
