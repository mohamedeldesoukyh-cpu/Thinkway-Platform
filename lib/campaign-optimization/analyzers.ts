import type { CampaignForecast, CreatorForecast } from "@/lib/campaign-forecast";

import {
  DELIVERABLE_CONCENTRATION_THRESHOLD,
  HIGH_COST_PER_REACH_MULTIPLIER,
  HIGH_OVERLAP_RATIO_THRESHOLD,
  LOW_REACH_EFFICIENCY_THRESHOLD,
  PLATFORM_CONCENTRATION_THRESHOLD,
  REACH_CONCENTRATION_THRESHOLD,
  TIER_IMBALANCE_THRESHOLD,
  resolvePlatformBenchmark,
  tierFromFollowers,
} from "./config";
import type { AnalyzerFinding, CampaignOptimizationContext } from "./types";

function shareMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const total = values.length || 1;
  return new Map([...counts.entries()].map(([key, count]) => [key, count / total]));
}

function creatorTier(creator: CreatorForecast, context?: CampaignOptimizationContext): string {
  return context?.creatorTiers?.[creator.creatorKey] ?? tierFromFollowers(creator.followers);
}

function topCreatorByReach(creators: CreatorForecast[]): CreatorForecast | null {
  if (!creators.length) return null;
  return [...creators].sort((a, b) => b.estimatedReach - a.estimatedReach)[0] ?? null;
}

export function analyzeReachOptimization(
  forecast: CampaignForecast
): AnalyzerFinding[] {
  const findings: AnalyzerFinding[] = [];
  const creators = [...forecast.creatorForecasts];
  const overlapRatio =
    forecast.grossReach > 0 ? forecast.overlapDeduction / forecast.grossReach : 0;
  const reachEfficiency =
    forecast.audienceSize > 0 ? forecast.estimatedReach / forecast.audienceSize : 0;

  if (overlapRatio >= HIGH_OVERLAP_RATIO_THRESHOLD) {
    const gainPct = Math.min(18, Math.round(overlapRatio * 100 * 0.6));
    findings.push({
      category: "reach",
      impact: overlapRatio >= 0.28 ? "high" : "medium",
      title: "Reduce audience overlap",
      summary: `Campaign overlap deducts ${forecast.overlapDeduction.toLocaleString()} reach (${Math.round(overlapRatio * 100)}% of gross).`,
      triggeredMetrics: ["overlapDeduction", "grossReach", "estimatedReach"],
      expectedReachGainPct: gainPct,
      confidence: 78,
      recommendationAction:
        "Replace overlapping creators in the same niche with creators from adjacent categories to reduce duplicate audience exposure.",
      recommendationReasoning: [
        `Overlap ratio ${(overlapRatio * 100).toFixed(1)}% exceeds ${HIGH_OVERLAP_RATIO_THRESHOLD * 100}% threshold.`,
        `Net reach ${forecast.estimatedReach.toLocaleString()} vs gross ${forecast.grossReach.toLocaleString()}.`,
      ],
      kpiDelta: {
        estimatedReach: Math.round(forecast.estimatedReach * (1 + gainPct / 100)),
      },
    });
  }

  const top = topCreatorByReach(creators);
  if (top && forecast.estimatedReach > 0) {
    const share = top.estimatedReach / forecast.estimatedReach;
    if (share >= REACH_CONCENTRATION_THRESHOLD && creators.length > 1) {
      const name = top.displayName ?? top.handle ?? top.creatorKey;
      findings.push({
        category: "reach",
        impact: share >= 0.6 ? "high" : "medium",
        title: "Reach concentrated in one creator",
        summary: `${name} contributes ${Math.round(share * 100)}% of estimated net reach.`,
        triggeredMetrics: ["creator.estimatedReach", "estimatedReach"],
        expectedReachGainPct: Math.round((share - 0.35) * 20),
        confidence: 72,
        recommendationAction: `Diversify reach by replacing ${name} with two creators at similar combined followers but lower audience overlap.`,
        recommendationReasoning: [
          `Top creator reach share ${(share * 100).toFixed(1)}% exceeds ${REACH_CONCENTRATION_THRESHOLD * 100}% threshold.`,
        ],
        metadata: { creatorKey: top.creatorKey, creatorName: name },
      });
    }
  }

  if (reachEfficiency < LOW_REACH_EFFICIENCY_THRESHOLD && forecast.audienceSize > 0) {
    findings.push({
      category: "reach",
      impact: "medium",
      title: "Low reach efficiency",
      summary: `Net reach is ${Math.round(reachEfficiency * 100)}% of audience size — deliverable mix may under-utilize the roster.`,
      triggeredMetrics: ["estimatedReach", "audienceSize"],
      expectedReachGainPct: 10,
      confidence: 65,
      recommendationAction:
        "Shift deliverables toward higher-reach formats (Reels, TikTok video) for creators with strong historical view performance.",
      recommendationReasoning: [
        `Reach efficiency ${(reachEfficiency * 100).toFixed(1)}% below ${LOW_REACH_EFFICIENCY_THRESHOLD * 100}% target.`,
      ],
    });
  }

  return findings;
}

export function analyzeBudgetOptimization(
  forecast: CampaignForecast,
  context?: CampaignOptimizationContext
): AnalyzerFinding[] {
  const budget = context?.budget?.amount ?? 0;
  if (budget <= 0 || forecast.estimatedReach <= 0) return [];

  const findings: AnalyzerFinding[] = [];
  const costPerReach = budget / forecast.estimatedReach;
  const costPerView =
    forecast.estimatedViews > 0 ? budget / forecast.estimatedViews : null;
  const costPerEngagement =
    forecast.estimatedEngagements > 0 ? budget / forecast.estimatedEngagements : null;
  const benchmarkCpr = 0.015;

  if (costPerReach > benchmarkCpr * HIGH_COST_PER_REACH_MULTIPLIER) {
    const savingsPct = Math.min(15, Math.round(((costPerReach / benchmarkCpr) - 1) * 8));
    findings.push({
      category: "budget",
      impact: "high",
      title: "Improve cost per reach",
      summary: `Cost per reach ${costPerReach.toFixed(4)} ${context?.budget?.currency ?? ""} exceeds efficient benchmark.`,
      triggeredMetrics: ["estimatedReach", "budget.amount"],
      expectedBudgetSavingsPct: savingsPct,
      expectedReachGainPct: 8,
      confidence: 70,
      recommendationAction:
        "Swap one high-cost macro creator for two micro creators in the same niche to improve cost per reach while maintaining audience size.",
      recommendationReasoning: [
        `Cost per reach ${costPerReach.toFixed(4)} vs benchmark ${benchmarkCpr.toFixed(4)}.`,
        costPerView != null
          ? `Cost per view ${costPerView.toFixed(4)} on projected ${forecast.estimatedViews.toLocaleString()} views.`
          : "View projection unavailable.",
        costPerEngagement != null
          ? `Cost per engagement ${costPerEngagement.toFixed(4)} on ${forecast.estimatedEngagements.toLocaleString()} engagements.`
          : "Engagement projection unavailable.",
      ],
    });
  }

  return findings;
}

export function analyzeCreatorMixOptimization(
  forecast: CampaignForecast,
  context?: CampaignOptimizationContext
): AnalyzerFinding[] {
  const creators = [...forecast.creatorForecasts];
  if (creators.length === 0) return [];

  const findings: AnalyzerFinding[] = [];
  const tiers = creators.map((c) => creatorTier(c, context));
  const tierShares = shareMap(tiers);
  const tierMix = context?.tierMix ?? [];

  for (const [tier, share] of tierShares) {
    if (share >= TIER_IMBALANCE_THRESHOLD && ["Macro", "Mega"].includes(tier)) {
      const microCount = Math.max(2, Math.round(creators.length * 0.25));
      findings.push({
        category: "creator_mix",
        impact: "medium",
        title: `Too many ${tier} creators`,
        summary: `${Math.round(share * 100)}% of the roster is ${tier} tier — engagement efficiency may suffer.`,
        triggeredMetrics: ["creator.followers", "creator.tier"],
        expectedEngagementGainPct: 7,
        confidence: 68,
        recommendationAction: `Replace one ${tier} creator with ${microCount} micro creators from the same niche to increase estimated engagement while maintaining reach.`,
        recommendationReasoning: [
          `${tier} share ${(share * 100).toFixed(0)}% exceeds ${TIER_IMBALANCE_THRESHOLD * 100}% balance threshold.`,
        ],
      });
    }
  }

  if (tierMix.length > 0) {
    for (const target of tierMix) {
      const actual = tiers.filter((t) => t.toLowerCase().includes(target.tier.toLowerCase())).length;
      const actualPct = (actual / creators.length) * 100;
      const gap = actualPct - target.percent;
      if (gap > 20) {
        findings.push({
          category: "creator_mix",
          impact: "low",
          title: `${target.tier} tier overweight vs strategy`,
          summary: `Strategy targets ${target.percent}% ${target.tier} but roster is ${Math.round(actualPct)}%.`,
          triggeredMetrics: ["tierMix", "creator.tier"],
          expectedEngagementGainPct: 5,
          confidence: 62,
          recommendationAction: `Rebalance toward ${target.percent}% ${target.tier} by swapping ${Math.ceil(gap / 15)} creators.`,
          recommendationReasoning: [`Tier mix deviation +${Math.round(gap)}% for ${target.tier}.`],
        });
      }
    }
  }

  const nanoMicroShare =
    (tierShares.get("Nano") ?? 0) + (tierShares.get("Micro") ?? 0);
  if (nanoMicroShare < 0.2 && creators.length >= 4) {
    findings.push({
      category: "creator_mix",
      impact: "low",
      title: "Under-utilized micro creator mix",
      summary: "Less than 20% of roster is Nano/Micro — engagement efficiency headroom exists.",
      triggeredMetrics: ["creator.tier"],
      expectedEngagementGainPct: 6,
      confidence: 60,
      recommendationAction: "Add 3 micro creators to improve engagement efficiency without sacrificing total audience size.",
      recommendationReasoning: [`Nano/Micro share ${Math.round(nanoMicroShare * 100)}% on ${creators.length} creators.`],
    });
  }

  return findings;
}

export function analyzePlatformOptimization(
  forecast: CampaignForecast,
  context?: CampaignOptimizationContext
): AnalyzerFinding[] {
  const creators = [...forecast.creatorForecasts];
  const platforms = creators.flatMap((c) => (c.platform ? [c.platform] : c.platforms));
  if (platforms.length === 0) return [];

  const findings: AnalyzerFinding[] = [];
  const shares = shareMap(platforms.map((p) => p.toLowerCase()));
  const briefPlatforms = (context?.campaignPlatform ? [context.campaignPlatform] : []).map((p) =>
    p.toLowerCase()
  );

  for (const [platform, share] of shares) {
    if (share >= PLATFORM_CONCENTRATION_THRESHOLD) {
      findings.push({
        category: "platform",
        impact: "medium",
        title: `Rebalance ${platform} allocation`,
        summary: `${Math.round(share * 100)}% of creators are on ${platform}.`,
        triggeredMetrics: ["creator.platform"],
        expectedViewGainPct: 12,
        confidence: 66,
        recommendationAction: `Add TikTok or YouTube creators (currently under-represented) to diversify platform reach.`,
        recommendationReasoning: [
          `${platform} concentration ${(share * 100).toFixed(0)}% exceeds ${PLATFORM_CONCENTRATION_THRESHOLD * 100}%.`,
        ],
      });
    }
  }

  const hasTikTok = platforms.some((p) => p.toLowerCase().includes("tiktok"));
  const hasInstagram = platforms.some((p) => p.toLowerCase().includes("instagram"));
  if (hasInstagram && !hasTikTok && creators.length >= 3) {
    findings.push({
      category: "platform",
      impact: "medium",
      title: "Increase TikTok allocation",
      summary: "Campaign is Instagram-heavy with no TikTok creators — view potential is constrained.",
      triggeredMetrics: ["creator.platform", "estimatedViews"],
      expectedViewGainPct: 18,
      confidence: 71,
      recommendationAction:
        "Add 2 TikTok creators in the same content niche to increase projected views by ~18% while maintaining Instagram reach.",
      recommendationReasoning: ["Zero TikTok creators on a multi-creator Instagram roster."],
    });
  }

  if (briefPlatforms.length > 0) {
    const offBrief = creators.filter(
      (c) => !briefPlatforms.some((bp) => (c.platform ?? "").toLowerCase().includes(bp))
    );
    if (offBrief.length > 0) {
      findings.push({
        category: "platform",
        impact: "low",
        title: "Remove off-brief platforms",
        summary: `${offBrief.length} creator(s) sit outside brief platform targets.`,
        triggeredMetrics: ["creator.platform", "campaignPlatform"],
        expectedReachGainPct: 4,
        confidence: 64,
        recommendationAction: `Replace off-platform creators with ${briefPlatforms.join("/")} alternatives aligned to the brief.`,
        recommendationReasoning: [`Brief platforms: ${briefPlatforms.join(", ")}.`],
      });
    }
  }

  return findings;
}

export function analyzeDeliverableOptimization(forecast: CampaignForecast): AnalyzerFinding[] {
  const deliverables = forecast.creatorForecasts.flatMap((c) => c.deliverableForecasts);
  if (deliverables.length === 0) return [];

  const findings: AnalyzerFinding[] = [];
  const types = deliverables.map((d) => d.contentType.toLowerCase());
  const shares = shareMap(types);

  for (const [contentType, share] of shares) {
    if (share >= DELIVERABLE_CONCENTRATION_THRESHOLD) {
      findings.push({
        category: "deliverable",
        impact: "medium",
        title: `Rebalance ${contentType} deliverables`,
        summary: `${Math.round(share * 100)}% of deliverables are ${contentType}.`,
        triggeredMetrics: ["deliverableForecasts.contentType"],
        expectedViewGainPct: 10,
        confidence: 63,
        recommendationAction: `Shift 1–2 deliverables from ${contentType} to Reels or TikTok video for higher view yield.`,
        recommendationReasoning: [
          `${contentType} share ${(share * 100).toFixed(0)}% exceeds ${DELIVERABLE_CONCENTRATION_THRESHOLD * 100}%.`,
        ],
      });
    }
  }

  const storyShare =
    types.filter((t) => t.includes("story")).length / Math.max(types.length, 1);
  const reelShare =
    types.filter((t) => t.includes("reel") || t.includes("video")).length / Math.max(types.length, 1);
  if (storyShare > 0.5 && reelShare < 0.25) {
    findings.push({
      category: "deliverable",
      impact: "low",
      title: "Stories-heavy deliverable mix",
      summary: "Stories dominate the deliverable mix — views and impressions may underperform.",
      triggeredMetrics: ["deliverableForecasts", "estimatedViews"],
      expectedViewGainPct: 14,
      confidence: 67,
      recommendationAction:
        "Convert 2 story deliverables to Reels to increase estimated views while keeping reach stable.",
      recommendationReasoning: [
        `Story share ${Math.round(storyShare * 100)}%; reel/video share ${Math.round(reelShare * 100)}%.`,
      ],
    });
  }

  return findings;
}

export function analyzeAudienceOptimization(
  forecast: CampaignForecast,
  context?: CampaignOptimizationContext
): AnalyzerFinding[] {
  const targets = context?.audienceTargets;
  if (!targets) {
    return [
      {
        category: "audience",
        impact: "low",
        title: "Audience targets not supplied",
        summary:
          "No brief audience targets in optimization context — audience dimension scored from forecast confidence and ER only.",
        triggeredMetrics: ["confidenceScore"],
        confidence: 50,
        recommendationAction:
          "Add country and language targets to the campaign brief to unlock geo/language audience optimization.",
        recommendationReasoning: ["audienceTargets missing from optimization context."],
      },
    ];
  }

  const findings: AnalyzerFinding[] = [];
  const avgEr = forecast.averageEngagementRate;
  const benchmark = resolvePlatformBenchmark(context?.campaignPlatform);

  if (avgEr != null && avgEr < benchmark * 0.85) {
    findings.push({
      category: "audience",
      impact: "medium",
      title: "Improve audience engagement quality",
      summary: `Roster ER ${avgEr.toFixed(1)}% is below ${benchmark}% platform benchmark.`,
      triggeredMetrics: ["averageEngagementRate"],
      expectedEngagementGainPct: 14,
      confidence: 69,
      recommendationAction:
        "Replace the lowest-ER creator with two niche-aligned micro creators sharing the target country and interest profile.",
      recommendationReasoning: [
        `Average ER ${avgEr.toFixed(1)}% vs ${benchmark}% benchmark.`,
        targets.countryCodes?.length
          ? `Target countries: ${targets.countryCodes.join(", ")}.`
          : "No country targets specified.",
      ],
    });
  }

  if (targets.categories?.length) {
    findings.push({
      category: "audience",
      impact: "low",
      title: "Align creators to interest categories",
      summary: `Brief targets categories: ${targets.categories.join(", ")}.`,
      triggeredMetrics: ["audienceTargets.categories"],
      expectedEngagementGainPct: 6,
      confidence: 58,
      recommendationAction:
        "Prioritize creators whose content categories match brief interests to lift engagement quality.",
      recommendationReasoning: ["Category alignment improves engagement forecast confidence."],
    });
  }

  return findings;
}

export function runAllAnalyzers(
  forecast: CampaignForecast,
  context?: CampaignOptimizationContext
): AnalyzerFinding[] {
  return [
    ...analyzeReachOptimization(forecast),
    ...analyzeBudgetOptimization(forecast, context),
    ...analyzeCreatorMixOptimization(forecast, context),
    ...analyzePlatformOptimization(forecast, context),
    ...analyzeDeliverableOptimization(forecast),
    ...analyzeAudienceOptimization(forecast, context),
  ];
}
