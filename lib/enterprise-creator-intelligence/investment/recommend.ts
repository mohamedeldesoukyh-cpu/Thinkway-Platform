import type {
  InvestmentConfidence,
  InvestmentDimensionScore,
  InvestmentRecommendation,
  InvestmentRecommendationInsight,
  InvestmentRisk,
  InvestmentSource,
} from "@/lib/enterprise-creator-intelligence/investment/types";

export function computeWeightedOverallScore(
  dimensions: InvestmentDimensionScore[]
): number | null {
  let weightedSum = 0;
  let weightSum = 0;
  for (const dim of dimensions) {
    if (dim.score == null) continue;
    weightedSum += dim.score * dim.weight;
    weightSum += dim.weight;
  }
  if (weightSum <= 0) return null;
  return Math.round(weightedSum / weightSum);
}

export function computeInvestmentConfidence(input: {
  dimensions: InvestmentDimensionScore[];
  layerLabelsPresent: string[];
  riskCount: number;
  criticalRiskCount: number;
}): InvestmentConfidence {
  const scored = input.dimensions.filter((d) => d.score != null);
  const coverage = scored.length / Math.max(input.dimensions.length, 1);
  const confidences = scored
    .map((d) => d.confidence)
    .filter((v): v is number => v != null);
  const avgDimConfidence =
    confidences.length > 0
      ? confidences.reduce((s, n) => s + n, 0) / confidences.length
      : null;

  let percent: number | null = null;
  if (scored.length === 0) {
    percent = null;
  } else {
    const base =
      (avgDimConfidence ?? 40) * 0.65 + coverage * 100 * 0.35;
    const layerBonus = Math.min(15, input.layerLabelsPresent.length * 2.5);
    const riskPenalty =
      input.criticalRiskCount * 12 + Math.max(0, input.riskCount - 2) * 3;
    percent = Math.round(
      Math.max(0, Math.min(100, base + layerBonus - riskPenalty))
    );
  }

  return {
    percent,
    reason:
      percent == null
        ? "No scored investment dimensions available."
        : `Based on ${scored.length}/${input.dimensions.length} dimensions, ${input.layerLabelsPresent.length} intelligence layers, and ${input.riskCount} risk(s).`,
    basedOn: [
      { label: "Scored dimensions", value: scored.length },
      { label: "Dimension coverage", value: Number(coverage.toFixed(3)) },
      {
        label: "Average dimension confidence",
        value: avgDimConfidence == null ? "n/a" : Math.round(avgDimConfidence),
      },
      ...input.layerLabelsPresent.map((label) => ({
        label: "Layer",
        value: label,
      })),
    ],
  };
}

export function classifyInvestmentRecommendation(input: {
  overallScore: number | null;
  confidencePercent: number | null;
  risks: InvestmentRisk[];
  scoredDimensionCount: number;
}): { recommendation: InvestmentRecommendation; why: string } {
  const { overallScore, confidencePercent, risks, scoredDimensionCount } = input;
  const critical = risks.filter((r) => r.severity === "Critical");
  const high = risks.filter((r) => r.severity === "High");

  if (
    overallScore == null ||
    scoredDimensionCount < 4 ||
    confidencePercent == null ||
    confidencePercent < 40
  ) {
    return {
      recommendation: "Insufficient Data",
      why: `Insufficient scored dimensions (${scoredDimensionCount}) or investment confidence (${confidencePercent ?? "n/a"}%) to form a business recommendation.`,
    };
  }

  if (critical.length > 0 || (overallScore < 45 && high.length >= 2)) {
    return {
      recommendation: "High Risk",
      why: critical.length
        ? `Critical risk(s): ${critical.map((r) => r.label).join(", ")}. Overall score ${overallScore}.`
        : `Overall score ${overallScore} with multiple high risks (${high.map((r) => r.label).join(", ")}).`,
    };
  }

  if (overallScore >= 80 && confidencePercent >= 70 && critical.length === 0) {
    return {
      recommendation: "Highly Recommended",
      why: `Strong multi-dimensional investment case (score ${overallScore}, confidence ${confidencePercent}%) with no critical risks.`,
    };
  }

  if (overallScore >= 65 && confidencePercent >= 55) {
    return {
      recommendation: "Recommended",
      why: `Solid investment case (score ${overallScore}, confidence ${confidencePercent}%). Review noted risks before scaling.`,
    };
  }

  if (overallScore >= 45) {
    return {
      recommendation: "Consider",
      why: `Mixed investment signals (score ${overallScore}, confidence ${confidencePercent}%). Suitable for selective or pilot use.`,
    };
  }

  return {
    recommendation: "High Risk",
    why: `Weak overall investment score (${overallScore}) relative to commercial risk tolerance.`,
  };
}

export function buildRecommendationInsight(input: {
  overallScore: number | null;
  dimensions: InvestmentDimensionScore[];
  risks: InvestmentRisk[];
  layerLabelsPresent: string[];
  source: InvestmentSource;
  computedAt: string;
}): InvestmentRecommendationInsight {
  const confidence = computeInvestmentConfidence({
    dimensions: input.dimensions,
    layerLabelsPresent: input.layerLabelsPresent,
    riskCount: input.risks.length,
    criticalRiskCount: input.risks.filter((r) => r.severity === "Critical").length,
  });

  const { recommendation, why } = classifyInvestmentRecommendation({
    overallScore: input.overallScore,
    confidencePercent: confidence.percent,
    risks: input.risks,
    scoredDimensionCount: input.dimensions.filter((d) => d.score != null).length,
  });

  const scoreMeaning =
    input.overallScore == null
      ? "No weighted investment score available."
      : `Weighted average of scored investment dimensions (renormalised over available weights). Score ${input.overallScore}/100.`;

  return {
    recommendation,
    why,
    confidence,
    score: input.overallScore,
    scoreMeaning,
    basedOnLayers: input.layerLabelsPresent,
    explainability: {
      value: recommendation,
      meaning: scoreMeaning,
      reason: why,
      evidence: [
        `Overall score: ${input.overallScore ?? "null"}`,
        `Confidence: ${confidence.percent ?? "null"}%`,
        ...input.layerLabelsPresent.map((l) => `Layer: ${l}`),
        ...input.risks.slice(0, 3).map((r) => `Risk: ${r.label} (${r.severity})`),
      ],
      confidence: confidence.percent,
      historicalTrend: "Computed from current Sprint 1–5 layer snapshot",
      businessContext:
        "Answers: if I invest in this creator today, how strong is the business case?",
      source: input.source,
      lastUpdated: input.computedAt,
      missingInputs: input.dimensions.flatMap((d) => d.missingInputs),
    },
  };
}
