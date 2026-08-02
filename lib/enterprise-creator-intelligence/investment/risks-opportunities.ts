import type { InvestmentLayerBundle } from "@/lib/enterprise-creator-intelligence/investment/dimensions";
import type {
  InvestmentDimensionScore,
  InvestmentOpportunity,
  InvestmentRisk,
} from "@/lib/enterprise-creator-intelligence/investment/types";

export function buildInvestmentRisks(
  layers: InvestmentLayerBundle,
  dimensions: InvestmentDimensionScore[]
): InvestmentRisk[] {
  const risks: InvestmentRisk[] = [];
  const byKey = Object.fromEntries(dimensions.map((d) => [d.key, d])) as Record<
    string,
    InvestmentDimensionScore
  >;

  const pricing = byKey.pricing_stability;
  if (pricing?.score != null && pricing.score < 45) {
    risks.push({
      key: "pricing_volatility",
      label: "Pricing volatility",
      severity: pricing.score < 30 ? "Critical" : "High",
      explanation:
        "Commercial pricing/stability signals indicate volatile or weak pricing history.",
      suggestedAction:
        "Lock quote ranges early and require commercial refresh before final IO.",
      evidence: pricing.supportingEvidence.slice(0, 3),
    });
  }

  const audienceStab = byKey.audience_stability;
  if (audienceStab?.score != null && audienceStab.score < 45) {
    risks.push({
      key: "audience_volatility",
      label: "Audience volatility",
      severity: audienceStab.score < 30 ? "Critical" : "High",
      explanation: "Audience Stability is Volatile or weak for planning trust.",
      suggestedAction:
        "Prefer shorter flights or require audience re-validation mid-campaign.",
      evidence: audienceStab.supportingEvidence.slice(0, 3),
    });
  }

  const perf = byKey.performance_reliability;
  if (
    layers.performance?.overallTrend === "Declining" ||
    (perf?.score != null && perf.score < 40)
  ) {
    risks.push({
      key: "performance_decline",
      label: "Performance decline",
      severity:
        layers.performance?.overallTrend === "Declining" ? "High" : "Medium",
      explanation:
        layers.performance?.trendExplanation.why ??
        "Performance reliability or trend indicates declining outcomes.",
      suggestedAction:
        "Review recent content performance and avoid large upfront commitments.",
      evidence: [
        `Overall trend: ${layers.performance?.overallTrend ?? "Unknown"}`,
        ...(perf?.supportingEvidence.slice(0, 2) ?? []),
      ],
    });
  }

  const campaign = byKey.campaign_success;
  const campaignCount =
    layers.commercial?.investmentReadiness.campaignCount ??
    layers.performance?.campaignPerformance.sampleCampaignCount ??
    0;
  if (campaignCount < 2) {
    risks.push({
      key: "limited_campaign_history",
      label: "Limited campaign history",
      severity: campaignCount < 1 ? "High" : "Medium",
      explanation: `Only ${campaignCount} Thinkway campaign sample(s) available for investment proof.`,
      suggestedAction:
        "Pilot with a smaller assignment before scaling investment.",
      evidence: [
        `Campaign count: ${campaignCount}`,
        ...(campaign?.supportingEvidence.slice(0, 2) ?? []),
      ],
    });
  }

  if (
    layers.commercial == null ||
    layers.commercial.investmentReadiness.status === "Needs More Data" ||
    layers.commercial.investmentReadiness.status === "Historical Only"
  ) {
    risks.push({
      key: "limited_commercial_data",
      label: "Limited commercial data",
      severity: layers.commercial == null ? "Critical" : "High",
      explanation:
        layers.commercial?.investmentReadiness.summary ??
        "Commercial Intelligence layer did not provide sufficient commercial metrics.",
      suggestedAction:
        "Capture quotations and campaign commercial results before recommending.",
      evidence: layers.commercial?.investmentReadiness.blockers ?? [
        "commercial_intelligence missing",
      ],
    });
  }

  if (layers.categoryBrand?.specialisation.level === "Emerging Category Shift") {
    risks.push({
      key: "rapid_category_shift",
      label: "Rapid category shift",
      severity: "Medium",
      explanation: layers.categoryBrand.specialisation.why,
      suggestedAction:
        "Confirm category fit for the brief; avoid assuming prior category affinity.",
      evidence: [
        `Specialisation: ${layers.categoryBrand.specialisation.level}`,
        ...layers.categoryBrand.businessReadiness.emergingCategories
          .slice(0, 3)
          .map((c) => `Emerging: ${c}`),
      ],
    });
  }

  const growth = layers.audience?.windows.lifetime.growth;
  if (
    growth &&
    (growth.suddenSpikes.length > 0 ||
      growth.suddenDrops.length > 0 ||
      growth.growthTrend === "Spike" ||
      growth.growthTrend === "Drop")
  ) {
    risks.push({
      key: "recent_audience_change",
      label: "Recent audience change",
      severity:
        growth.growthTrend === "Drop" || growth.suddenDrops.length > 0
          ? "High"
          : "Medium",
      explanation: growth.why || growth.whatChanged,
      suggestedAction:
        "Investigate spike/drop causes before treating followers as stable reach.",
      evidence: [
        `Trend: ${growth.growthTrend}`,
        `Spikes: ${growth.suddenSpikes.length}`,
        `Drops: ${growth.suddenDrops.length}`,
      ],
    });
  }

  const missing = dimensions.flatMap((d) => d.missingInputs);
  if (missing.length >= 3) {
    risks.push({
      key: "missing_data",
      label: "Missing data",
      severity: missing.length >= 6 ? "Critical" : "Medium",
      explanation: `Multiple investment dimensions lack inputs (${missing.length} missing signals).`,
      suggestedAction:
        "Refresh Historical, Commercial, Performance, and Audience captures.",
      evidence: [...new Set(missing)].slice(0, 8),
    });
  }

  return risks;
}

export function buildInvestmentOpportunities(
  layers: InvestmentLayerBundle,
  dimensions: InvestmentDimensionScore[]
): InvestmentOpportunity[] {
  const opportunities: InvestmentOpportunity[] = [];
  const byKey = Object.fromEntries(dimensions.map((d) => [d.key, d])) as Record<
    string,
    InvestmentDimensionScore
  >;

  if (
    (layers.categoryBrand?.businessReadiness.emergingCategories.length ?? 0) > 0 ||
    layers.categoryBrand?.specialisation.level === "Highly Specialised"
  ) {
    opportunities.push({
      key: "growing_category",
      label: "Growing category",
      explanation:
        layers.categoryBrand?.specialisation.level === "Highly Specialised"
          ? "Creator shows high category expertise suitable for specialised briefs."
          : `Emerging categories detected: ${layers.categoryBrand?.businessReadiness.emergingCategories.join(", ")}.`,
      evidence: [
        `Specialisation: ${layers.categoryBrand?.specialisation.level ?? "n/a"}`,
        ...(layers.categoryBrand?.businessReadiness.emergingCategories ?? []),
      ],
      businessContext: "Useful for category-led Planning Workspace recommendations.",
    });
  }

  const roi = layers.performance?.campaignPerformance.campaignRoi;
  if (roi != null && roi >= 0.2) {
    opportunities.push({
      key: "strong_roi_trend",
      label: "Strong ROI trend",
      explanation: `Thinkway campaign ROI is ${roi}, supporting a positive commercial investment case.`,
      evidence: [
        `ROI: ${roi}`,
        `EMV: ${layers.performance?.campaignPerformance.campaignEmv ?? "n/a"}`,
        `Campaign samples: ${layers.performance?.campaignPerformance.sampleCampaignCount ?? 0}`,
      ],
      businessContext: "Supports Recommended / Highly Recommended commercial cases.",
    });
  }

  if (
    layers.audience?.quality.level === "High Quality" ||
    layers.audience?.quality.level === "Good"
  ) {
    opportunities.push({
      key: "excellent_audience_quality",
      label: "Excellent audience quality",
      explanation: layers.audience.quality.meaning,
      evidence: layers.audience.quality.supportedIndicators.slice(0, 4),
      businessContext: "Strengthens Client Workspace audience-fit narratives.",
    });
  }

  if (
    layers.performance?.reliability.level === "Highly Reliable" ||
    layers.performance?.reliability.level === "Reliable" ||
    (byKey.performance_reliability?.score != null &&
      byKey.performance_reliability.score >= 75)
  ) {
    opportunities.push({
      key: "consistent_performance",
      label: "Consistent performance",
      explanation: layers.performance?.reliability.meaning ?? "Performance reliability is strong.",
      evidence: [
        `Reliability: ${layers.performance?.reliability.level ?? "n/a"}`,
        `Stability: ${layers.performance?.stability.level ?? "n/a"}`,
        `Trend: ${layers.performance?.overallTrend ?? "n/a"}`,
      ],
      businessContext: "Reduces outcome uncertainty for Campaign Workspace.",
    });
  }

  const affinity = layers.categoryBrand?.brandAffinity;
  if (affinity && (affinity.repeatedCollaborations > 0 || affinity.longTermPartnerships > 0)) {
    opportunities.push({
      key: "repeat_client_success",
      label: "Repeat client success",
      explanation:
        "Creator shows repeated or long-term brand collaborations — a proxy for client success.",
      evidence: [
        `Repeated: ${affinity.repeatedCollaborations}`,
        `Long-term: ${affinity.longTermPartnerships}`,
        `Recent: ${affinity.recentPartnerships}`,
      ],
      businessContext: "Supports premium relationship-based investment pitches.",
    });
  }

  if (
    affinity &&
    affinity.brands.some(
      (b) =>
        b.affinity.includes("Long-term Partnerships") ||
        b.affinity.includes("Repeated Collaborations")
    )
  ) {
    opportunities.push({
      key: "premium_brand_affinity",
      label: "Premium brand affinity",
      explanation:
        "Brand affinity patterns include Repeated Collaborations or Long-term Partnerships.",
      evidence: affinity.brands
        .slice(0, 3)
        .map((b) => `${b.brandName}: ${b.affinity.join(", ")}`),
      businessContext: "Useful for brand-safe premium campaign recommendations.",
    });
  }

  const priceMove = layers.commercial?.metrics.find((m) => m.key === "price_movement");
  if (
    priceMove?.currentValue != null &&
    priceMove.currentValue <= 0 &&
    (byKey.pricing_stability?.score ?? 0) >= 60
  ) {
    opportunities.push({
      key: "pricing_advantage",
      label: "Pricing advantage",
      explanation:
        "Price movement is flat or declining while pricing stability remains healthy.",
      evidence: [
        `Price movement: ${priceMove.currentValue}`,
        `Pricing stability score: ${byKey.pricing_stability?.score ?? "n/a"}`,
      ],
      businessContext: "May improve negotiation leverage for Planning.",
    });
  }

  return opportunities;
}
