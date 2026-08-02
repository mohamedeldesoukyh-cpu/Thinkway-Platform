import type { CreatorAudienceIntelligence } from "@/lib/enterprise-creator-intelligence/audience/types";
import type { CreatorCategoryBrandIntelligence } from "@/lib/enterprise-creator-intelligence/category-brand/types";
import type { CreatorCommercialIntelligence } from "@/lib/enterprise-creator-intelligence/commercial/types";
import type { CreatorMonthlyMetrics } from "@/lib/enterprise-creator-intelligence/historical/types";
import type { CreatorPerformanceIntelligence } from "@/lib/enterprise-creator-intelligence/performance/types";
import {
  averageNullable,
  mapAudienceQuality,
  mapAudienceStability,
  mapCampaignSuccess,
  mapCommercialHealthLevel,
  mapContentConsistency,
  mapGrowthStability,
  mapInvestmentReadiness,
  mapPerformanceReliability,
  mapPublishingEffectiveness,
  mapSpecialisation,
} from "@/lib/enterprise-creator-intelligence/investment/map-score";
import type {
  InvestmentDimensionKey,
  InvestmentDimensionScore,
  InvestmentSource,
} from "@/lib/enterprise-creator-intelligence/investment/types";
import {
  INVESTMENT_DIMENSION_LABELS,
  INVESTMENT_DIMENSION_WEIGHTS,
} from "@/lib/enterprise-creator-intelligence/investment/types";

export type InvestmentLayerBundle = {
  influencerId: string;
  platform: string | null;
  computedAt: string;
  historicalMonthly: CreatorMonthlyMetrics[] | null;
  commercial: CreatorCommercialIntelligence | null;
  categoryBrand: CreatorCategoryBrandIntelligence | null;
  performance: CreatorPerformanceIntelligence | null;
  audience: CreatorAudienceIntelligence | null;
};

function sourceFrom(input: {
  platform: string | null;
  refreshTime: string | null;
  confidence: number | null;
  method: string;
}): InvestmentSource {
  return {
    platform: input.platform,
    collectionMethod: input.method,
    refreshTime: input.refreshTime,
    confidence: input.confidence,
  };
}

function buildDimension(input: {
  key: InvestmentDimensionKey;
  score: number | null;
  confidence: number | null;
  explanation: string;
  supportingEvidence: string[];
  historicalTrend: string;
  source: InvestmentSource;
  lastUpdated: string | null;
  missingInputs: string[];
  meaning: string;
  reason: string;
  businessContext: string;
}): InvestmentDimensionScore {
  const weight = INVESTMENT_DIMENSION_WEIGHTS[input.key];
  const weightedContribution =
    input.score == null ? null : Number((input.score * weight).toFixed(2));

  return {
    key: input.key,
    label: INVESTMENT_DIMENSION_LABELS[input.key],
    score: input.score,
    confidence: input.confidence,
    weight,
    weightedContribution,
    explanation: input.explanation,
    supportingEvidence: input.supportingEvidence,
    historicalTrend: input.historicalTrend,
    source: input.source,
    lastUpdated: input.lastUpdated,
    missingInputs: input.missingInputs,
    explainability: {
      value: input.score,
      meaning: input.meaning,
      reason: input.reason,
      evidence: input.supportingEvidence,
      confidence: input.confidence,
      historicalTrend: input.historicalTrend,
      businessContext: input.businessContext,
      source: input.source,
      lastUpdated: input.lastUpdated,
      missingInputs: input.missingInputs,
    },
  };
}

export function buildInvestmentDimensions(
  layers: InvestmentLayerBundle
): InvestmentDimensionScore[] {
  const platform = layers.platform;
  const computedAt = layers.computedAt;
  const commercial = layers.commercial;
  const performance = layers.performance;
  const audience = layers.audience;
  const categoryBrand = layers.categoryBrand;
  const monthly = layers.historicalMonthly ?? [];

  const commercialEfficiency = buildDimension({
    key: "commercial_efficiency",
    score: mapCommercialHealthLevel(
      commercial?.commercialHealth.dimensions.efficiency
    ),
    confidence: commercial?.investmentReadiness.averageConfidence ?? null,
    explanation:
      commercial == null
        ? "Commercial Intelligence unavailable — efficiency cannot be scored."
        : `Mapped from Commercial Health efficiency: ${commercial.commercialHealth.dimensions.efficiency}.`,
    supportingEvidence: commercial
      ? [
          `Commercial health: ${commercial.commercialHealth.level}`,
          `Efficiency dimension: ${commercial.commercialHealth.dimensions.efficiency}`,
          ...(commercial.commercialHealth.reasons.slice(0, 2) ?? []),
        ]
      : [],
    historicalTrend:
      commercial?.metrics.find((m) => m.key === "cpm")?.trendLabel ??
      "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: commercial?.computedAt ?? null,
      confidence: commercial?.investmentReadiness.averageConfidence ?? null,
      method: "Sprint 2 Commercial Intelligence · commercialHealth.dimensions.efficiency",
    }),
    lastUpdated: commercial?.computedAt ?? null,
    missingInputs: commercial ? [] : ["commercial_intelligence"],
    meaning: "How efficiently creator spend converts to media outcomes.",
    reason: "Derived from Commercial Health efficiency — not recomputed CPM/CPE.",
    businessContext:
      "Planning uses this to judge cost efficiency before committing budget.",
  });

  const performanceReliability = buildDimension({
    key: "performance_reliability",
    score: mapPerformanceReliability(performance?.reliability.level),
    confidence: performance?.reliability.confidence.percent ?? null,
    explanation:
      performance == null
        ? "Performance Intelligence unavailable."
        : performance.reliability.meaning,
    supportingEvidence: performance
      ? [
          `Reliability: ${performance.reliability.level}`,
          `Stability: ${performance.stability.level}`,
          `Overall trend: ${performance.overallTrend}`,
          performance.reliability.why,
        ]
      : [],
    historicalTrend: performance?.overallTrend ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: performance?.computedAt ?? null,
      confidence: performance?.reliability.confidence.percent ?? null,
      method: "Sprint 4 Performance Intelligence · reliability",
    }),
    lastUpdated: performance?.computedAt ?? null,
    missingInputs: performance ? [] : ["performance_intelligence"],
    meaning: "Whether historical performance can be trusted for planning.",
    reason: "Mapped from Performance Reliability classification.",
    businessContext:
      "Low reliability raises campaign delivery and outcome risk.",
  });

  const audienceQuality = buildDimension({
    key: "audience_quality",
    score: mapAudienceQuality(audience?.quality.level),
    confidence: audience?.quality.confidence.percent ?? null,
    explanation:
      audience == null
        ? "Audience Intelligence unavailable."
        : audience.quality.meaning,
    supportingEvidence: audience
      ? [
          `Quality: ${audience.quality.level}`,
          ...audience.quality.supportedIndicators.slice(0, 3),
          "Fake-follower estimation: not performed",
        ]
      : [],
    historicalTrend: audience?.windows.lifetime.growth.growthTrend ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: audience?.computedAt ?? null,
      confidence: audience?.quality.confidence.percent ?? null,
      method: "Sprint 5 Audience Intelligence · quality (supported indicators only)",
    }),
    lastUpdated: audience?.computedAt ?? null,
    missingInputs: audience
      ? audience.quality.level === "Unknown"
        ? ["audience_quality_indicators"]
        : []
      : ["audience_intelligence"],
    meaning: "Supported audience quality signal strength for commercial use.",
    reason: "Mapped from Audience Quality — never estimates fake followers.",
    businessContext: "Client Workspace uses this for brand-safety and fit checks.",
  });

  const audienceStability = buildDimension({
    key: "audience_stability",
    score: mapAudienceStability(audience?.stability.level),
    confidence: audience?.stability.confidence.percent ?? null,
    explanation:
      audience == null
        ? "Audience Intelligence unavailable."
        : audience.stability.meaning,
    supportingEvidence: audience
      ? [
          `Stability: ${audience.stability.level}`,
          audience.stability.why,
          `Commercial audience readiness: ${audience.businessReadiness.commercialAudienceReadiness}`,
        ]
      : [],
    historicalTrend: audience?.stability.level ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: audience?.computedAt ?? null,
      confidence: audience?.stability.confidence.percent ?? null,
      method: "Sprint 5 Audience Intelligence · stability",
    }),
    lastUpdated: audience?.computedAt ?? null,
    missingInputs: audience ? [] : ["audience_intelligence"],
    meaning: "How stable the creator's audience base is over time.",
    reason: "Mapped from Audience Stability classification.",
    businessContext: "Volatile audiences reduce long-term planning confidence.",
  });

  const growthTrend = audience?.windows.lifetime.growth.growthTrend ?? null;
  const spikeCount = audience?.windows.lifetime.growth.suddenSpikes.length ?? 0;
  const dropCount = audience?.windows.lifetime.growth.suddenDrops.length ?? 0;
  const growthStability = buildDimension({
    key: "growth_stability",
    score: mapGrowthStability(growthTrend, spikeCount, dropCount),
    confidence:
      audience?.windows.lifetime.growth.confidence.percent ??
      (monthly.length >= 3 ? 55 : null),
    explanation:
      audience == null && monthly.length === 0
        ? "No audience growth or monthly follower history available."
        : `Growth trend ${growthTrend ?? "Unknown"} with ${spikeCount} spike(s) and ${dropCount} drop(s); Sprint 1 monthly series length ${monthly.length}.`,
    supportingEvidence: [
      ...(audience
        ? [
            `Growth trend: ${growthTrend}`,
            audience.windows.lifetime.growth.whatChanged,
            audience.windows.lifetime.growth.why,
          ]
        : []),
      ...(monthly.length
        ? [`Historical monthly rows: ${monthly.length}`]
        : ["historical_monthly_metrics missing"]),
    ],
    historicalTrend: growthTrend ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: audience?.computedAt ?? monthly[monthly.length - 1]?.computedAt ?? null,
      confidence: audience?.windows.lifetime.growth.confidence.percent ?? null,
      method: "Sprint 5 Audience growth + Sprint 1 monthly follower history",
    }),
    lastUpdated: audience?.computedAt ?? monthly[monthly.length - 1]?.computedAt ?? null,
    missingInputs:
      audience || monthly.length
        ? monthly.length < 3
          ? ["sufficient_monthly_growth_history"]
          : []
        : ["audience_growth", "historical_monthly_metrics"],
    meaning: "Whether follower growth is organic and stable vs spiky.",
    reason: "Mapped from Audience Growth trend with spike/drop penalties.",
    businessContext: "Sudden spikes/drops require diligence before investment.",
  });

  const categoryExpertise = buildDimension({
    key: "category_expertise",
    score: mapSpecialisation(categoryBrand?.specialisation.level),
    confidence: categoryBrand?.specialisation.confidence.percent ?? null,
    explanation:
      categoryBrand == null
        ? "Category & Brand Intelligence unavailable."
        : categoryBrand.specialisation.meaning,
    supportingEvidence: categoryBrand
      ? [
          `Specialisation: ${categoryBrand.specialisation.level}`,
          categoryBrand.specialisation.why,
          `Primary categories: ${categoryBrand.businessReadiness.primaryCategories.join(", ") || "none"}`,
        ]
      : [],
    historicalTrend: categoryBrand?.specialisation.level ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: categoryBrand?.computedAt ?? null,
      confidence: categoryBrand?.specialisation.confidence.percent ?? null,
      method: "Sprint 3 Category & Brand Intelligence · specialisation",
    }),
    lastUpdated: categoryBrand?.computedAt ?? null,
    missingInputs: categoryBrand ? [] : ["category_brand_intelligence"],
    meaning: "Depth of category focus for brand fit.",
    reason: "Mapped from Category Specialisation.",
    businessContext: "Strong expertise improves category-aligned campaign fit.",
  });

  const affinity = categoryBrand?.brandAffinity;
  const affinityScore =
    affinity == null
      ? null
      : Math.round(
          Math.min(
            100,
            affinity.repeatedCollaborations * 12 +
              affinity.longTermPartnerships * 18 +
              affinity.recentPartnerships * 8 +
              Math.min(affinity.brands.length, 5) * 6 +
              (affinity.oneOffCollaborations > 0 ? 10 : 0)
          )
        );
  const brandAffinity = buildDimension({
    key: "brand_affinity",
    score: affinityScore,
    confidence: categoryBrand?.businessReadiness.categoryConfidence ?? null,
    explanation:
      affinity == null
        ? "Brand affinity unavailable."
        : `Repeated ${affinity.repeatedCollaborations}, long-term ${affinity.longTermPartnerships}, recent ${affinity.recentPartnerships}, brands ${affinity.brands.length}.`,
    supportingEvidence: affinity
      ? [
          `Repeated collaborations: ${affinity.repeatedCollaborations}`,
          `Long-term partnerships: ${affinity.longTermPartnerships}`,
          `Recent partnerships: ${affinity.recentPartnerships}`,
          `Brand count: ${affinity.brands.length}`,
        ]
      : [],
    historicalTrend:
      affinity && affinity.recentPartnerships > 0
        ? "Recent brand activity"
        : affinity && affinity.dormantPartnerships > 0
          ? "Dormant partnerships present"
          : "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: categoryBrand?.computedAt ?? null,
      confidence: categoryBrand?.businessReadiness.categoryConfidence ?? null,
      method: "Sprint 3 Category & Brand Intelligence · brandAffinity",
    }),
    lastUpdated: categoryBrand?.computedAt ?? null,
    missingInputs: categoryBrand ? [] : ["category_brand_intelligence"],
    meaning: "Evidence of repeatable brand collaboration patterns.",
    reason: "Scored from Brand Affinity summary counts — not sentiment.",
    businessContext: "Repeat client success strengthens investment case.",
  });

  const campaign = performance?.campaignPerformance;
  const campaignSuccess = buildDimension({
    key: "campaign_success",
    score: mapCampaignSuccess({
      roi: campaign?.campaignRoi ?? null,
      sampleCampaignCount: campaign?.sampleCampaignCount ?? 0,
      campaignSuccess: campaign?.campaignSuccess ?? null,
    }),
    confidence: campaign?.confidence.percent ?? null,
    explanation:
      campaign == null
        ? "Campaign performance unavailable."
        : `Campaign ROI ${campaign.campaignRoi ?? "n/a"} across ${campaign.sampleCampaignCount} campaign sample(s); success trend ${campaign.campaignSuccess}.`,
    supportingEvidence: campaign
      ? [
          `ROI: ${campaign.campaignRoi ?? "null"}`,
          `EMV: ${campaign.campaignEmv ?? "null"}`,
          `Sample campaigns: ${campaign.sampleCampaignCount}`,
          `Success trend: ${campaign.campaignSuccess}`,
          ...campaign.explainability.evidence.slice(0, 2),
        ]
      : [],
    historicalTrend: campaign?.campaignSuccess ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: performance?.computedAt ?? null,
      confidence: campaign?.confidence.percent ?? null,
      method: "Sprint 4 Performance · campaignPerformance (reuses Sprint 2 ROI/EMV)",
    }),
    lastUpdated: performance?.computedAt ?? null,
    missingInputs:
      !campaign || campaign.sampleCampaignCount < 1
        ? ["thinkway_campaign_history"]
        : [],
    meaning: "Thinkway campaign commercial outcomes for this creator.",
    reason: "Mapped from campaign ROI/success — reuses commercial formulas.",
    businessContext: "Strong campaign success is the clearest investment proof.",
  });

  const operationalReliability = buildDimension({
    key: "operational_reliability",
    score: averageNullable([
      mapPublishingEffectiveness(performance?.publishingEffectiveness.level),
      mapPerformanceReliability(performance?.reliability.level),
    ]),
    confidence: averageNullable([
      performance?.publishingEffectiveness.confidence.percent,
      performance?.reliability.confidence.percent,
    ]),
    explanation:
      performance == null
        ? "Operational signals unavailable."
        : `Publishing ${performance.publishingEffectiveness.level}; reliability ${performance.reliability.level}.`,
    supportingEvidence: performance
      ? [
          `Publishing: ${performance.publishingEffectiveness.level}`,
          performance.publishingEffectiveness.meaning,
          `Reliability: ${performance.reliability.level}`,
        ]
      : [],
    historicalTrend: performance?.publishingEffectiveness.level ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: performance?.computedAt ?? null,
      confidence: performance?.publishingEffectiveness.confidence.percent ?? null,
      method: "Sprint 4 Performance · publishingEffectiveness + reliability",
    }),
    lastUpdated: performance?.computedAt ?? null,
    missingInputs: performance ? [] : ["performance_intelligence"],
    meaning: "Delivery consistency and operational predictability.",
    reason: "Average of publishing effectiveness and performance reliability maps.",
    businessContext: "Ops teams need predictable creators for campaign execution.",
  });

  const contentConsistency = buildDimension({
    key: "content_consistency",
    score: mapContentConsistency(categoryBrand?.contentConsistency.level),
    confidence: categoryBrand?.contentConsistency.confidence.percent ?? null,
    explanation:
      categoryBrand == null
        ? "Content consistency unavailable."
        : categoryBrand.contentConsistency.meaning,
    supportingEvidence: categoryBrand
      ? [
          `Consistency: ${categoryBrand.contentConsistency.level}`,
          ...categoryBrand.contentConsistency.explainability.evidence.slice(0, 2),
        ]
      : [],
    historicalTrend: categoryBrand?.contentConsistency.level ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: categoryBrand?.computedAt ?? null,
      confidence: categoryBrand?.contentConsistency.confidence.percent ?? null,
      method: "Sprint 3 Category & Brand Intelligence · contentConsistency",
    }),
    lastUpdated: categoryBrand?.computedAt ?? null,
    missingInputs: categoryBrand ? [] : ["category_brand_intelligence"],
    meaning: "How consistent content behaviour is over windows.",
    reason: "Mapped from Content Consistency classification.",
    businessContext: "Consistent content supports predictable brand storytelling.",
  });

  const pricingStability = buildDimension({
    key: "pricing_stability",
    score: averageNullable([
      mapCommercialHealthLevel(commercial?.commercialHealth.dimensions.pricing),
      mapCommercialHealthLevel(
        commercial?.commercialHealth.dimensions.commercialStability
      ),
    ]),
    confidence: commercial?.investmentReadiness.averageConfidence ?? null,
    explanation:
      commercial == null
        ? "Pricing stability unavailable."
        : `Pricing ${commercial.commercialHealth.dimensions.pricing}; commercial stability ${commercial.commercialHealth.dimensions.commercialStability}.`,
    supportingEvidence: commercial
      ? [
          `Pricing health: ${commercial.commercialHealth.dimensions.pricing}`,
          `Commercial stability: ${commercial.commercialHealth.dimensions.commercialStability}`,
          ...(commercial.metrics
            .filter((m) => m.key === "price_movement" || m.key === "negotiation_trend")
            .map(
              (m) =>
                `${m.key}: ${m.currentValue ?? "null"} (${m.trendLabel ?? "n/a"})`
            ) ?? []),
        ]
      : [],
    historicalTrend:
      commercial?.metrics.find((m) => m.key === "price_movement")?.trendLabel ??
      "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: commercial?.computedAt ?? null,
      confidence: commercial?.investmentReadiness.averageConfidence ?? null,
      method: "Sprint 2 Commercial Intelligence · pricing + commercialStability",
    }),
    lastUpdated: commercial?.computedAt ?? null,
    missingInputs: commercial ? [] : ["commercial_intelligence"],
    meaning: "Whether creator pricing is stable enough to plan against.",
    reason: "Mapped from commercial pricing and stability health dimensions.",
    businessContext: "Pricing volatility complicates negotiation and budgeting.",
  });

  const commercialConfidence = buildDimension({
    key: "commercial_confidence",
    score: averageNullable([
      mapCommercialHealthLevel(
        commercial?.commercialHealth.dimensions.commercialConfidence
      ),
      mapInvestmentReadiness(commercial?.investmentReadiness.status),
    ]),
    confidence: commercial?.investmentReadiness.averageConfidence ?? null,
    explanation:
      commercial == null
        ? "Commercial confidence unavailable."
        : `Commercial confidence ${commercial.commercialHealth.dimensions.commercialConfidence}; readiness ${commercial.investmentReadiness.status}.`,
    supportingEvidence: commercial
      ? [
          `Readiness: ${commercial.investmentReadiness.status}`,
          `Campaign count: ${commercial.investmentReadiness.campaignCount}`,
          `Metric coverage: ${commercial.investmentReadiness.metricCoverage}`,
          ...commercial.investmentReadiness.blockers.slice(0, 2),
        ]
      : [],
    historicalTrend: commercial?.investmentReadiness.status ?? "Unknown",
    source: sourceFrom({
      platform,
      refreshTime: commercial?.computedAt ?? null,
      confidence: commercial?.investmentReadiness.averageConfidence ?? null,
      method: "Sprint 2 Commercial Intelligence · commercialConfidence + investmentReadiness",
    }),
    lastUpdated: commercial?.computedAt ?? null,
    missingInputs: commercial ? [] : ["commercial_intelligence"],
    meaning: "Confidence in commercial data completeness for investment.",
    reason: "Mapped from commercial confidence health and investment readiness.",
    businessContext: "Low commercial confidence blocks High recommendations.",
  });

  const audienceReadyScore =
    audience?.businessReadiness.commercialAudienceReadiness === "Ready"
      ? 90
      : audience?.businessReadiness.commercialAudienceReadiness ===
          "Limited Confidence"
        ? 55
        : audience?.businessReadiness.commercialAudienceReadiness ===
            "Insufficient Growth History"
          ? 45
          : audience?.businessReadiness.commercialAudienceReadiness ===
              "Needs Demographics"
            ? 30
            : null;

  const businessReadiness = buildDimension({
    key: "business_readiness",
    score: averageNullable([
      mapInvestmentReadiness(commercial?.investmentReadiness.status),
      audienceReadyScore,
      categoryBrand?.businessReadiness.categoryConfidence ?? null,
    ]),
    confidence: averageNullable([
      commercial?.investmentReadiness.averageConfidence,
      audience?.businessReadiness.audienceConfidence,
      categoryBrand?.businessReadiness.categoryConfidence,
    ]),
    explanation:
      "Composite readiness from Commercial, Audience, and Category business-readiness surfaces.",
    supportingEvidence: [
      commercial
        ? `Commercial readiness: ${commercial.investmentReadiness.status}`
        : "Commercial readiness missing",
      audience
        ? `Audience readiness: ${audience.businessReadiness.commercialAudienceReadiness}`
        : "Audience readiness missing",
      categoryBrand
        ? `Category confidence: ${categoryBrand.businessReadiness.categoryConfidence ?? "null"}`
        : "Category readiness missing",
    ],
    historicalTrend: "Layer composite",
    source: sourceFrom({
      platform,
      refreshTime: computedAt,
      confidence: null,
      method:
        "Sprint 2 investmentReadiness + Sprint 5 commercialAudienceReadiness + Sprint 3 categoryConfidence",
    }),
    lastUpdated: computedAt,
    missingInputs: [
      ...(commercial ? [] : ["commercial_intelligence"]),
      ...(audience ? [] : ["audience_intelligence"]),
      ...(categoryBrand ? [] : ["category_brand_intelligence"]),
    ],
    meaning: "Whether Planning can trust this creator for business decisions today.",
    reason: "Average of commercial, audience, and category readiness signals.",
    businessContext:
      "Reusable across Planning → Client → Campaign → Reporting → Analytics → AI → Mobile.",
  });

  return [
    commercialEfficiency,
    performanceReliability,
    audienceQuality,
    audienceStability,
    growthStability,
    categoryExpertise,
    brandAffinity,
    campaignSuccess,
    operationalReliability,
    contentConsistency,
    pricingStability,
    commercialConfidence,
    businessReadiness,
  ];
}
