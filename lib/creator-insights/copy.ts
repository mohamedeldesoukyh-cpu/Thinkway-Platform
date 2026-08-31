import { contentFormatLabel, contentFormatSingular } from "./content-format";
import { formatMetricNumber, metricNoun } from "./stats";
import type { ContentFormatFamily, DetectedCreatorInsight } from "./types";

export type RecommendationCopy = {
  title: string;
  explanation: string;
  recommendation: string;
};

function hedge(confidence: DetectedCreatorInsight["confidence"], strong: string, weak: string): string {
  return confidence === "high" ? strong : weak;
}

function formatFact(insight: DetectedCreatorInsight, key: string, metricKey?: string): string {
  const value = insight.facts[key];
  if (typeof value !== "number") return String(value ?? "");
  return formatMetricNumber(value, metricKey ?? insight.metricKey ?? "views");
}

export function deterministicCopy(insight: DetectedCreatorInsight): RecommendationCopy {
  switch (insight.type) {
    case "performance_trend":
      return trendCopy(insight);
    case "strong_content_type":
      return contentTypeCopy(insight);
    case "engagement_opportunity":
      return engagementCopy(insight);
    case "publication_timing":
      return timingCopy(insight);
    case "campaign_specific":
      return campaignCopy(insight);
    case "data_enrichment":
      return enrichmentCopy(insight);
  }
}

function trendCopy(insight: DetectedCreatorInsight): RecommendationCopy {
  const trend = insight.facts.trend === "down" ? "below" : "above";
  const metric = metricNoun(String(insight.facts.metricKey ?? insight.metricKey ?? "views"));
  const windowSize = insight.facts.windowSize ?? insight.sampleSize;
  return {
    title:
      trend === "above"
        ? "Performing above your average"
        : "Recent performance is below your average",
    explanation: hedge(
      insight.confidence,
      `Your last ${windowSize} publications averaged ${formatFact(insight, "recentMean")} ${metric}, consistently ${trend} your previous ${windowSize} (${formatFact(insight, "priorMean")}).`,
      `Your recent posts suggest ${metric} around ${formatFact(insight, "recentMean")}, compared with ${formatFact(insight, "priorMean")} on your previous ${windowSize}.`
    ),
    recommendation:
      trend === "above"
        ? "Consider using a similar format for your next campaign deliverable."
        : "Review what changed in your recent posts before your next deliverable.",
  };
}

function contentTypeCopy(insight: DetectedCreatorInsight): RecommendationCopy {
  const strongest = contentFormatLabel(insight.formatFamily ?? "short_video");
  const comparison = contentFormatLabel(
    (insight.facts.comparisonFamily as ContentFormatFamily | undefined) ?? "static_post"
  );
  const metric = metricNoun(String(insight.facts.metricKey ?? "views"));
  return {
    title: `${capitalize(strongest)} are currently your strongest format`,
    explanation: hedge(
      insight.confidence,
      `Your recent ${strongest} consistently generated higher ${metric} (${formatFact(insight, "strongestMean")}) than ${comparison} (${formatFact(insight, "comparisonMean")}).`,
      `Your recent posts suggest ${strongest} are generating higher ${metric} (${formatFact(insight, "strongestMean")}) than ${comparison} (${formatFact(insight, "comparisonMean")}).`
    ),
    recommendation: `Consider using more ${strongest} for your next campaign deliverable.`,
  };
}

function engagementCopy(insight: DetectedCreatorInsight): RecommendationCopy {
  return {
    title: "Strong views, quieter interaction",
    explanation: hedge(
      insight.confidence,
      `Your recent videos consistently received strong views (${formatFact(insight, "recentViews", "views")}) while comments (${formatFact(insight, "recentComments", "comments")}) stayed below your previous average (${formatFact(insight, "priorComments", "comments")}).`,
      `Your recent posts suggest strong views (${formatFact(insight, "recentViews", "views")}) with fewer comments (${formatFact(insight, "recentComments", "comments")}) than your previous average (${formatFact(insight, "priorComments", "comments")}).`
    ),
    recommendation:
      "Consider a stronger call-to-action that encourages comments. This is a suggestion, not a guaranteed lift.",
  };
}

function timingCopy(insight: DetectedCreatorInsight): RecommendationCopy {
  const day = String(insight.facts.strongestWeekday ?? "weekdays");
  const metric = metricNoun(String(insight.facts.metricKey ?? "views"));
  return {
    title: `Strongest recent posts were on ${day}s`,
    explanation: hedge(
      insight.confidence,
      `Your strongest recent publications were published on ${day}s, averaging ${formatFact(insight, "strongestMean")} ${metric} versus ${formatFact(insight, "overallMean")} overall.`,
      `Your strongest recent posts were published around ${day}s. This is a pattern in your history, not a proven cause.`
    ),
    recommendation: `If it fits the campaign brief, consider publishing your next deliverable on a ${day}.`,
  };
}

function campaignCopy(insight: DetectedCreatorInsight): RecommendationCopy {
  const upcoming = String(insight.facts.upcomingLabel ?? "upcoming deliverable");
  const family = contentFormatSingular(insight.formatFamily ?? "short_video");
  const strongest = contentFormatLabel(insight.formatFamily ?? "short_video");
  return {
    title: `Your ${upcoming} matches a format that has been working`,
    explanation: hedge(
      insight.confidence,
      `Your next campaign deliverable is a ${family}. Your recent ${strongest} have generated stronger ${metricNoun(String(insight.facts.metricKey ?? "engagementRate"))} than ${contentFormatLabel((insight.facts.comparisonFamily as ContentFormatFamily) ?? "static_post")}.`,
      `Your next campaign deliverable is a ${family}. Your recent posts suggest ${strongest} have been performing better than ${contentFormatLabel((insight.facts.comparisonFamily as ContentFormatFamily) ?? "static_post")}.`
    ),
    recommendation: `Consider leaning into the same ${family} approach that has recently performed well for you.`,
  };
}

function enrichmentCopy(insight: DetectedCreatorInsight): RecommendationCopy {
  const suggested = String(insight.facts.suggestedProvider ?? "a social account");
  const collecting =
    Number(insight.facts.observationCount ?? 0) < 3 || Number(insight.facts.dataLevel ?? 0) === 0;
  if (collecting) {
    return {
      title: "Thinkway is collecting more performance data",
      explanation:
        "There is not enough comparable performance history yet to recommend a specific next move.",
      recommendation: `Connect ${suggested} on Profile → Social Accounts to unlock richer insights. You can keep working without connecting.`,
    };
  }
  return {
    title: "Unlock richer performance insights",
    explanation: insight.facts.stale
      ? "Based on your latest synced data, Thinkway can still use your campaign history, but platform insights may be out of date."
      : "Thinkway can already use your campaign and publication history. Connected platform data makes recommendations more specific.",
    recommendation: `Connect ${suggested} on Profile → Social Accounts when you are ready. Nothing is blocked.`,
  };
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function applyStalePrefix(explanation: string, stale: boolean): string {
  if (!stale) return explanation;
  if (explanation.startsWith("Based on your latest synced data")) return explanation;
  return `Based on your latest synced data, ${explanation.charAt(0).toLowerCase()}${explanation.slice(1)}`;
}
