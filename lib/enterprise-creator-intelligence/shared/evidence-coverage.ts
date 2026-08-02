import type {
  EvidenceBasedOn,
  EvidenceCoverage,
} from "@/lib/enterprise-creator-intelligence/shared/types";

export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Confidence must never exceed Evidence Coverage.
 * Low evidence must never silently produce high confidence.
 */
export function clampConfidenceToEvidence(
  confidencePercent: number | null | undefined,
  evidenceCoveragePercent: number | null | undefined
): number | null {
  if (confidencePercent == null || !Number.isFinite(confidencePercent)) {
    return null;
  }
  if (evidenceCoveragePercent == null || !Number.isFinite(evidenceCoveragePercent)) {
    return null;
  }
  return clampPercent(Math.min(confidencePercent, evidenceCoveragePercent));
}

export function buildEvidenceCoverage(input: {
  signals: Array<{ label: string; present: boolean; weight: number }>;
  missingInputs?: string[];
  extraBasedOn?: EvidenceBasedOn;
}): EvidenceCoverage {
  const totalWeight = input.signals.reduce((s, x) => s + x.weight, 0);
  if (totalWeight <= 0) {
    return {
      percent: null,
      reason: "No evidence signals defined.",
      basedOn: input.extraBasedOn ?? [],
      missingInputs: input.missingInputs ?? ["evidence_signals"],
    };
  }

  const earned = input.signals.reduce(
    (s, x) => s + (x.present ? x.weight : 0),
    0
  );
  const percent = clampPercent((earned / totalWeight) * 100);
  const basedOn: EvidenceBasedOn = [
    ...input.signals.map((x) => ({
      label: x.label,
      value: x.present ? "available" : "missing",
    })),
    ...(input.extraBasedOn ?? []),
  ];
  const missingInputs =
    input.missingInputs ??
    input.signals.filter((x) => !x.present).map((x) => x.label);

  return {
    percent,
    reason: `Evidence coverage ${percent}% from ${input.signals.filter((x) => x.present).length}/${input.signals.length} information surfaces.`,
    basedOn,
    missingInputs,
  };
}

export function historicalEvidenceCoverage(input: {
  monthCount: number;
  sampleCaptureCount: number;
}): EvidenceCoverage {
  return buildEvidenceCoverage({
    signals: [
      { label: "historical_months", present: input.monthCount >= 1, weight: 40 },
      { label: "multi_month_series", present: input.monthCount >= 3, weight: 30 },
      {
        label: "capture_samples",
        present: input.sampleCaptureCount >= 1,
        weight: 30,
      },
    ],
    extraBasedOn: [
      { label: "months", value: input.monthCount },
      { label: "sample_captures", value: input.sampleCaptureCount },
    ],
    missingInputs: [
      ...(input.monthCount < 1 ? ["historical_months"] : []),
      ...(input.monthCount < 3 ? ["multi_month_series"] : []),
      ...(input.sampleCaptureCount < 1 ? ["capture_samples"] : []),
    ],
  });
}

export function commercialEvidenceCoverage(input: {
  campaignCount: number;
  publicationCount: number;
  quoteCount: number;
  monthCount: number;
}): EvidenceCoverage {
  return buildEvidenceCoverage({
    signals: [
      { label: "campaign_history", present: input.campaignCount >= 1, weight: 30 },
      {
        label: "multi_campaign_history",
        present: input.campaignCount >= 2,
        weight: 20,
      },
      {
        label: "commercial_publications",
        present: input.publicationCount >= 1,
        weight: 20,
      },
      { label: "quotation_history", present: input.quoteCount >= 1, weight: 15 },
      { label: "historical_months", present: input.monthCount >= 1, weight: 15 },
    ],
    extraBasedOn: [
      { label: "campaigns", value: input.campaignCount },
      { label: "publications", value: input.publicationCount },
      { label: "quotes", value: input.quoteCount },
      { label: "months", value: input.monthCount },
    ],
  });
}

export function categoryBrandEvidenceCoverage(input: {
  postCount: number;
  brandCount: number;
}): EvidenceCoverage {
  return buildEvidenceCoverage({
    signals: [
      { label: "content_posts", present: input.postCount >= 1, weight: 45 },
      { label: "multi_post_sample", present: input.postCount >= 5, weight: 25 },
      { label: "brand_mentions", present: input.brandCount >= 1, weight: 30 },
    ],
    extraBasedOn: [
      { label: "posts", value: input.postCount },
      { label: "brands", value: input.brandCount },
    ],
  });
}

export function performanceEvidenceCoverage(input: {
  publicationCount: number;
  campaignPublicationCount: number;
  hasWatchOrCompletion: boolean;
}): EvidenceCoverage {
  return buildEvidenceCoverage({
    signals: [
      {
        label: "performance_publications",
        present: input.publicationCount >= 1,
        weight: 40,
      },
      {
        label: "multi_publication_sample",
        present: input.publicationCount >= 6,
        weight: 25,
      },
      {
        label: "campaign_performance",
        present: input.campaignPublicationCount >= 1,
        weight: 25,
      },
      {
        label: "watch_or_completion",
        present: input.hasWatchOrCompletion,
        weight: 10,
      },
    ],
    extraBasedOn: [
      { label: "publications", value: input.publicationCount },
      { label: "campaign_publications", value: input.campaignPublicationCount },
    ],
  });
}

export function audienceEvidenceCoverage(input: {
  hasDemographics: boolean;
  hasGrowthHistory: boolean;
  hasEngagementSignals: boolean;
  hasGeography: boolean;
}): EvidenceCoverage {
  return buildEvidenceCoverage({
    signals: [
      { label: "audience_demographics", present: input.hasDemographics, weight: 35 },
      { label: "growth_history", present: input.hasGrowthHistory, weight: 25 },
      {
        label: "engagement_behaviour",
        present: input.hasEngagementSignals,
        weight: 20,
      },
      { label: "geography", present: input.hasGeography, weight: 20 },
    ],
  });
}

export function investmentEvidenceCoverage(input: {
  layerFlags: {
    historical: boolean;
    commercial: boolean;
    categoryBrand: boolean;
    performance: boolean;
    audience: boolean;
  };
  scoredDimensionCount: number;
  totalDimensions: number;
}): EvidenceCoverage {
  const layers = input.layerFlags;
  return buildEvidenceCoverage({
    signals: [
      { label: "historical_layer", present: layers.historical, weight: 15 },
      { label: "commercial_layer", present: layers.commercial, weight: 20 },
      { label: "category_brand_layer", present: layers.categoryBrand, weight: 15 },
      { label: "performance_layer", present: layers.performance, weight: 20 },
      { label: "audience_layer", present: layers.audience, weight: 15 },
      {
        label: "scored_dimensions",
        present: input.scoredDimensionCount >= 4,
        weight: 15,
      },
    ],
    extraBasedOn: [
      {
        label: "scored_dimensions",
        value: `${input.scoredDimensionCount}/${input.totalDimensions}`,
      },
    ],
  });
}
