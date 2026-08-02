import type {
  CommercialMetricKey,
  CommercialTrendLabel,
} from "@/lib/enterprise-creator-intelligence/commercial/types";
import { metricTrendPolarity } from "@/lib/enterprise-creator-intelligence/commercial/trend";

function pctDelta(current: number, baseline: number): number {
  if (baseline === 0) return 0;
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

/**
 * Business context / meaning for Planning, Client, AI, Reporting.
 * Uses creator history when available; never invents category/market benchmarks.
 */
export function buildCommercialContext(input: {
  key: CommercialMetricKey;
  label: string;
  currentValue: number | null;
  previousValue: number | null;
  creatorAverage: number | null;
  trendLabel: CommercialTrendLabel;
  missingInputs: string[];
}): { meaning: string; reason: string; businessContext: string } {
  const { key, label, currentValue, previousValue, creatorAverage, trendLabel, missingInputs } =
    input;

  if (currentValue == null) {
    const missing =
      missingInputs.length > 0
        ? ` Missing: ${missingInputs.join(", ")}.`
        : "";
    return {
      meaning: `${label} is not yet available.`,
      reason: `Insufficient Thinkway inputs to compute ${label}.${missing}`,
      businessContext: `${label} cannot support Planning or Client decisions until required commercial inputs are present.`,
    };
  }

  const polarity = metricTrendPolarity(key);
  let comparisonSentence = "";

  if (creatorAverage != null && Number.isFinite(creatorAverage) && creatorAverage !== 0) {
    const delta = pctDelta(currentValue, creatorAverage);
    const abs = Math.abs(delta).toFixed(0);
    if (polarity === "lower_is_better") {
      comparisonSentence =
        delta < -1
          ? `Lower than creator historical average by ${abs}%.`
          : delta > 1
            ? `Higher than creator historical average by ${abs}%.`
            : "In line with creator historical average.";
    } else if (polarity === "price_direction") {
      comparisonSentence =
        delta > 1
          ? `Higher than creator historical average by ${abs}%.`
          : delta < -1
            ? `Lower than creator historical average by ${abs}%.`
            : "In line with creator historical average.";
    } else {
      comparisonSentence =
        delta > 1
          ? `Higher than creator historical average by ${abs}%.`
          : delta < -1
            ? `Lower than creator historical average by ${abs}%.`
            : "In line with creator historical average.";
    }
  } else if (previousValue != null && Number.isFinite(previousValue) && previousValue !== 0) {
    const delta = pctDelta(currentValue, previousValue);
    const abs = Math.abs(delta).toFixed(0);
    comparisonSentence =
      Math.abs(delta) < 1
        ? "Unchanged versus previous period."
        : delta > 0
          ? `Up ${abs}% versus previous period.`
          : `Down ${abs}% versus previous period.`;
  } else {
    comparisonSentence = "Baseline commercial reading from Thinkway data.";
  }

  const meaningByKey: Partial<Record<CommercialMetricKey, string>> = {
    cpm: "Cost efficiency of media delivery per thousand impressions.",
    cpe: "Cost efficiency of engagement outcomes.",
    emv: "Estimated media value of delivered impressions at Thinkway commercial rates.",
    roi: "Commercial return relative to creator campaign investment.",
    average_views: "Typical view delivery from historical creator performance.",
    median_views: "Midpoint view delivery — resistant to outlier posts.",
    average_reach: "Typical audience reach from Thinkway campaign publications.",
    estimated_reach: "Forecast / estimated reach where actual reach is unavailable.",
    cost_per_deliverable: "Average Thinkway cost to produce one deliverable.",
    historical_pricing: "Average negotiated / quoted creator pricing history.",
    negotiation_trend: "Direction of quoted pricing across negotiation history.",
    price_movement: "Latest quote movement versus the prior quote.",
  };

  const meaning = meaningByKey[key] ?? `${label} commercial metric.`;

  let businessContext = comparisonSentence;
  if (key === "roi" && trendLabel === "Improving") {
    businessContext = `${comparisonSentence} Higher than creator historical average.`.replace(
      /\. Higher than creator historical average\./,
      ". Stronger commercial return than prior creator performance."
    );
    if (creatorAverage != null && currentValue > creatorAverage) {
      businessContext = "Higher than creator historical average.";
    }
  }
  if (key === "emv" && currentValue != null) {
    businessContext =
      comparisonSentence.includes("historical")
        ? `${comparisonSentence} Strong commercial return compared to campaign investment when EMV exceeds cost.`
        : "Strong commercial return compared to campaign investment when EMV exceeds cost.";
  }
  if (key === "cpm" && creatorAverage != null && currentValue < creatorAverage) {
    const abs = Math.abs(pctDelta(currentValue, creatorAverage)).toFixed(0);
    businessContext = `Lower than creator historical average by ${abs}%.`;
  }

  return {
    meaning,
    reason: `${label} is ${trendLabel.toLowerCase()}. ${comparisonSentence}`,
    businessContext,
  };
}
