import {
  brandDisplayName,
  classifySponsored,
  extractPostMentions,
  industryFromCategory,
  type CategoryBrandPostFact,
} from "@/lib/enterprise-creator-intelligence/category-brand/classify";
import {
  buildBaseSource,
  buildCategoryConfidence,
} from "@/lib/enterprise-creator-intelligence/category-brand/distribution";
import type {
  AnalysisWindowKey,
  BrandAffinityKind,
  BrandAffinitySummary,
  BrandCollaboration,
  BrandCollaborationKind,
  CategoryShare,
} from "@/lib/enterprise-creator-intelligence/category-brand/types";
import { ANALYSIS_WINDOWS } from "@/lib/enterprise-creator-intelligence/category-brand/types";
import { isWithinWindow } from "@/lib/enterprise-creator-intelligence/category-brand/windows";

type BrandAccumulator = {
  handle: string;
  brandName: string;
  mentions: Array<{
    at: string | null;
    kind: BrandCollaborationKind;
    campaignType: string | null;
    categories: string[];
  }>;
};

function emptyWindows(): Record<AnalysisWindowKey, number> {
  return {
    last_30_days: 0,
    last_90_days: 0,
    last_180_days: 0,
    lifetime: 0,
  };
}

function classifyAffinity(input: {
  mentionCount: number;
  firstAt: number | null;
  lastAt: number | null;
  asOfMs: number;
}): BrandAffinityKind[] {
  const kinds: BrandAffinityKind[] = [];
  const { mentionCount, firstAt, lastAt, asOfMs } = input;
  if (mentionCount <= 1) {
    kinds.push("One-off Collaborations");
  } else {
    kinds.push("Repeated Collaborations");
  }

  if (firstAt != null && lastAt != null && lastAt - firstAt >= 90 * 24 * 60 * 60 * 1000) {
    kinds.push("Long-term Partnerships");
  }
  if (lastAt != null && asOfMs - lastAt <= 90 * 24 * 60 * 60 * 1000) {
    kinds.push("Recent Partnerships");
  }
  if (
    lastAt != null &&
    asOfMs - lastAt > 180 * 24 * 60 * 60 * 1000 &&
    mentionCount >= 1
  ) {
    kinds.push("Dormant Partnerships");
  }
  return kinds;
}

export function buildBrandIntelligence(input: {
  posts: Array<{ post: CategoryBrandPostFact; categories: string[] }>;
  platform: string | null;
  asOfMs: number;
  lastUpdated: string;
}): { brands: BrandCollaboration[]; brandAffinity: BrandAffinitySummary } {
  const byHandle = new Map<string, BrandAccumulator>();

  for (const { post, categories } of input.posts) {
    const mentions = extractPostMentions(post);
    if (mentions.length === 0) continue;
    const kind = classifySponsored(post);
    for (const handle of mentions) {
      const existing = byHandle.get(handle) ?? {
        handle,
        brandName: brandDisplayName(handle),
        mentions: [],
      };
      existing.mentions.push({
        at: post.postedAt,
        kind,
        campaignType: post.campaignType,
        categories,
      });
      byHandle.set(handle, existing);
    }
  }

  const brands: BrandCollaboration[] = [...byHandle.values()]
    .map((acc) => {
      const windows = emptyWindows();
      for (const mention of acc.mentions) {
        for (const window of ANALYSIS_WINDOWS) {
          if (isWithinWindow(mention.at, window, input.asOfMs)) {
            windows[window] += 1;
          }
        }
      }

      const times = acc.mentions
        .map((m) => (m.at ? new Date(m.at).getTime() : NaN))
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b);
      const firstAt = times[0] ?? null;
      const lastAt = times[times.length - 1] ?? null;
      const lastCollaboration =
        lastAt == null ? null : new Date(lastAt).toISOString();

      const sponsored = acc.mentions.filter((m) => m.kind === "Sponsored").length;
      const organic = acc.mentions.filter((m) => m.kind === "Organic").length;
      const collaborationKind: BrandCollaborationKind =
        sponsored > organic ? "Sponsored" : organic > 0 ? "Organic" : "Unknown";

      const industryVotes = new Map<string, number>();
      for (const mention of acc.mentions) {
        for (const category of mention.categories) {
          if (category === "Other") continue;
          const industry = industryFromCategory(category);
          industryVotes.set(industry, (industryVotes.get(industry) ?? 0) + 1);
        }
      }
      const industry =
        [...industryVotes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const campaignType =
        acc.mentions.map((m) => m.campaignType).find((v) => v) ?? null;

      const confidence = buildCategoryConfidence(
        acc.mentions.length,
        "lifetime"
      );
      const source = buildBaseSource({
        platform: input.platform,
        window: "lifetime",
        confidence: confidence.percent,
        lastRefresh: input.lastUpdated,
        analysisMethod:
          "Mention extraction from captions/hashtags; sponsored heuristics; industry from co-occurring categories",
      });

      const affinity = classifyAffinity({
        mentionCount: acc.mentions.length,
        firstAt,
        lastAt,
        asOfMs: input.asOfMs,
      });

      const businessContext = `${acc.brandName} appears ${acc.mentions.length} time(s); affinity: ${affinity.join(", ")}.`;

      return {
        brandName: acc.brandName,
        industry,
        collaborationKind,
        mentionCount: acc.mentions.length,
        collaborationFrequency: Number(
          (acc.mentions.length / Math.max(1, input.posts.length)).toFixed(3)
        ),
        lastCollaboration,
        campaignType,
        windows,
        affinity,
        confidence,
        source,
        sentimentExtension: {
          available: false as const,
          note: "Sentiment analysis extension point — not calculated in Sprint 3.",
        },
        explainability: {
          value: acc.mentions.length,
          meaning: `Brand collaboration signal for ${acc.brandName}.`,
          confidence: confidence.percent,
          evidence: [
            `${acc.mentions.length} mentions`,
            `Kind: ${collaborationKind}`,
            industry ? `Industry: ${industry}` : "Industry unknown",
          ],
          historicalTrend: lastCollaboration
            ? `Last collaboration ${lastCollaboration}`
            : "No dated collaboration.",
          businessContext,
          dataSource: source,
          lastUpdated: input.lastUpdated,
          missingInputs: acc.mentions.length === 0 ? ["mentions"] : [],
        },
      } satisfies BrandCollaboration;
    })
    .sort((a, b) => b.mentionCount - a.mentionCount || a.brandName.localeCompare(b.brandName));

  const summaryCounts = {
    repeatedCollaborations: brands.filter((b) =>
      b.affinity.includes("Repeated Collaborations")
    ).length,
    oneOffCollaborations: brands.filter((b) =>
      b.affinity.includes("One-off Collaborations")
    ).length,
    longTermPartnerships: brands.filter((b) =>
      b.affinity.includes("Long-term Partnerships")
    ).length,
    recentPartnerships: brands.filter((b) =>
      b.affinity.includes("Recent Partnerships")
    ).length,
    dormantPartnerships: brands.filter((b) =>
      b.affinity.includes("Dormant Partnerships")
    ).length,
  };

  const confidence = buildCategoryConfidence(brands.length, "lifetime");
  const source = buildBaseSource({
    platform: input.platform,
    window: "multi_window",
    confidence: confidence.percent,
    lastRefresh: input.lastUpdated,
    analysisMethod: "Brand affinity classification from mention frequency and recency",
  });

  const brandAffinity: BrandAffinitySummary = {
    ...summaryCounts,
    brands,
    explainability: {
      value: brands.length,
      meaning: "Brand affinity summary across repeated, one-off, long-term, recent, and dormant partnerships.",
      confidence: confidence.percent,
      evidence: [
        `${brands.length} brands`,
        `${summaryCounts.repeatedCollaborations} repeated`,
        `${summaryCounts.oneOffCollaborations} one-off`,
      ],
      historicalTrend: "Affinity derived from dated mention history.",
      businessContext:
        "Planning can use affinity to prioritise creators with proven brand relationships.",
      dataSource: source,
      lastUpdated: input.lastUpdated,
      missingInputs: brands.length === 0 ? ["brand_mentions"] : [],
    },
  };

  return { brands, brandAffinity };
}

export function primarySecondaryEmerging(categories: CategoryShare[]): {
  primaryCategories: string[];
  secondaryCategories: string[];
  emergingCategories: string[];
} {
  const ranked = categories.filter((c) => c.category !== "Other");
  return {
    primaryCategories: ranked.filter((c) => c.percent >= 25).map((c) => c.category),
    secondaryCategories: ranked
      .filter((c) => c.percent >= 10 && c.percent < 25)
      .map((c) => c.category),
    emergingCategories: ranked
      .filter((c) => c.trend === "Emerging" || c.trend === "Increasing")
      .map((c) => c.category),
  };
}
