import {
  buildBrandIntelligence,
  primarySecondaryEmerging,
} from "@/lib/enterprise-creator-intelligence/category-brand/brands";
import {
  computeContentConsistency,
  computeSpecialisation,
} from "@/lib/enterprise-creator-intelligence/category-brand/behaviour";
import {
  classifyContentMixTypes,
  classifyPostCategories,
  type CategoryBrandPostFact,
} from "@/lib/enterprise-creator-intelligence/category-brand/classify";
import {
  assertPercentTotal100,
  buildBaseSource,
  buildCategoryShares,
  buildContentMixShares,
  buildIndustryShares,
} from "@/lib/enterprise-creator-intelligence/category-brand/distribution";
import type {
  AnalysisWindowKey,
  ContentMixType,
  CreatorCategoryBrandIntelligence,
  WindowCategoryBundle,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";
import {
  ANALYSIS_WINDOWS,
  CATEGORY_BRAND_CONSUMERS,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";
import { isWithinWindow } from "@/lib/enterprise-creator-intelligence/category-brand/windows";

export type CreatorCategoryBrandFacts = {
  influencerId: string;
  platform: string | null;
  computedAt?: string;
  posts: CategoryBrandPostFact[];
  /** Optional prior lifetime category counts for trend comparison. */
  priorLifetimeCategoryCounts?: Map<string, number> | null;
};

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function buildWindowBundle(input: {
  window: AnalysisWindowKey;
  posts: Array<{ post: CategoryBrandPostFact; categories: string[] }>;
  platform: string | null;
  asOfMs: number;
  lastUpdated: string;
  priorCounts?: Map<string, number> | null;
}): WindowCategoryBundle {
  const inWindow = input.posts.filter(({ post }) =>
    isWithinWindow(post.postedAt, input.window, input.asOfMs)
  );

  const categoryCounts = new Map<string, number>();
  const mixCounts = new Map<ContentMixType, number>();

  for (const { post, categories } of inWindow) {
    // Multi-label posts contribute equally — each category gets one vote.
    for (const category of categories) {
      bump(categoryCounts, category);
    }
    for (const mix of classifyContentMixTypes(post)) {
      bump(mixCounts, mix);
    }
  }

  const categories = buildCategoryShares({
    counts: categoryCounts,
    priorCounts: input.priorCounts ?? null,
    window: input.window,
    platform: input.platform,
    analysedPostCount: inWindow.length,
    lastUpdated: input.lastUpdated,
  });

  if (!assertPercentTotal100(categories) && categories.length > 0) {
    throw new Error(
      `Category percentages must total 100 for window ${input.window}`
    );
  }

  const contentMix = buildContentMixShares({
    counts: mixCounts,
    window: input.window,
    platform: input.platform,
    analysedPostCount: inWindow.length,
    lastUpdated: input.lastUpdated,
  });

  if (!assertPercentTotal100(contentMix) && contentMix.length > 0) {
    throw new Error(
      `Content mix percentages must total 100 for window ${input.window}`
    );
  }

  const industries = buildIndustryShares({
    categoryShares: categories,
    window: input.window,
    platform: input.platform,
    lastUpdated: input.lastUpdated,
  });

  return {
    window: input.window,
    analysedPostCount: inWindow.length,
    categories,
    totalPercent: categories.reduce((sum, row) => sum + row.percent, 0),
    contentMix,
    industries,
    missingInputs: inWindow.length === 0 ? ["posts_in_window"] : [],
  };
}

/** Pure Category & Brand intelligence from content facts. */
export function computeCreatorCategoryBrandIntelligence(
  facts: CreatorCategoryBrandFacts
): CreatorCategoryBrandIntelligence {
  const computedAt = facts.computedAt ?? new Date().toISOString();
  const asOfMs = new Date(computedAt).getTime();

  const classified = facts.posts.map((post) => ({
    post,
    categories: classifyPostCategories(post),
  }));

  const windows = {} as Record<AnalysisWindowKey, WindowCategoryBundle>;
  for (const window of ANALYSIS_WINDOWS) {
    windows[window] = buildWindowBundle({
      window,
      posts: classified,
      platform: facts.platform,
      asOfMs,
      lastUpdated: computedAt,
      priorCounts:
        window === "lifetime" ? facts.priorLifetimeCategoryCounts ?? null : null,
    });
  }

  // Cross-window trends: compare 30d vs 180d shares where possible.
  const longShares = new Map(
    windows.last_180_days.categories.map((c) => [c.category, c.percent])
  );
  windows.last_30_days = {
    ...windows.last_30_days,
    categories: windows.last_30_days.categories.map((share) => {
      const prior = longShares.get(share.category) ?? null;
      if (prior == null) return share;
      const delta = share.percent - prior;
      const trend =
        Math.abs(delta) < 3
          ? ("Stable" as const)
          : delta > 0
            ? share.percent < 12
              ? ("Emerging" as const)
              : ("Increasing" as const)
            : ("Declining" as const);
      const whatChanged = `${share.category} moved from ${prior}% (180d) to ${share.percent}% (30d).`;
      return {
        ...share,
        trend,
        whatChanged,
        whyChanged: `Short-window behavioural share changed by ${delta} pp versus 180-day baseline.`,
        historicalTrend: whatChanged,
        businessImplication:
          trend === "Increasing" || trend === "Emerging"
            ? `${share.category} is rising in recent content — useful for timely briefs.`
            : trend === "Declining"
              ? `${share.category} is cooling in recent content.`
              : share.businessImplication,
        explainability: {
          ...share.explainability,
          historicalTrend: whatChanged,
          evidence: [...share.explainability.evidence, whatChanged],
        },
      };
    }),
  };

  const { brands, brandAffinity } = buildBrandIntelligence({
    posts: classified,
    platform: facts.platform,
    asOfMs,
    lastUpdated: computedAt,
  });

  const lifetime = windows.lifetime;
  const focus = primarySecondaryEmerging(lifetime.categories);
  const contentConsistency = computeContentConsistency({
    windows: ANALYSIS_WINDOWS.map((key) => windows[key]),
    platform: facts.platform,
    lastUpdated: computedAt,
  });
  const specialisation = computeSpecialisation({
    categories: lifetime.categories,
    emergingCategories: focus.emergingCategories,
    platform: facts.platform,
    lastUpdated: computedAt,
    analysedPostCount: lifetime.analysedPostCount,
  });

  const categoryConfidence =
    lifetime.categories[0]?.confidence.percent ??
    (lifetime.analysedPostCount === 0 ? null : 0);

  const source = buildBaseSource({
    platform: facts.platform,
    window: "multi_window",
    confidence: categoryConfidence,
    lastRefresh: computedAt,
  });

  const businessReadiness = {
    primaryCategories: focus.primaryCategories,
    secondaryCategories: focus.secondaryCategories,
    emergingCategories: focus.emergingCategories,
    commercialIndustries: lifetime.industries.map((i) => i.industry),
    brandAffinity,
    specialisation,
    contentConsistency,
    categoryConfidence,
  };

  return {
    influencerId: facts.influencerId,
    platform: facts.platform,
    computedAt,
    windows,
    brands,
    brandAffinity,
    contentConsistency,
    specialisation,
    businessReadiness,
    source,
    aiHints: {
      available: lifetime.analysedPostCount > 0 || brands.length > 0,
      primaryCategory: focus.primaryCategories[0] ?? null,
      emergingCategories: focus.emergingCategories,
      specialisation: specialisation.level,
      contentConsistency: contentConsistency.level,
      brandCount: brands.length,
      recommendRefresh: facts.posts.length === 0,
    },
    consumers: CATEGORY_BRAND_CONSUMERS,
  };
}
