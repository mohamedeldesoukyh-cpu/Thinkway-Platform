import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  BudgetSectionData,
  CreatorsSectionData,
  CreatorActivationTimeline,
  CreatorMixTier,
  PerformanceSectionData,
  RiskAnalysisSectionData,
  StrategySectionData,
  TimelineSectionExtras,
} from "@/features/campaign-intelligence/types/section-schemas";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { buildRiskAnalysisFromBudget } from "@/features/campaign-intelligence/services/structured-section-builders";
import {
  deriveCreativeConcepts,
  deriveWhyAiInsights,
} from "@/features/campaign-studio/services/presentation-intelligence";
import { deriveInfluencerContentPlan } from "./influencer-content-plan";

import type { SearchCreatorCardItem } from "./creator-platform-utils";
import { estimateCreatorPostFee } from "./creator-fee-estimator";
import { studioForecastArtifacts } from "./campaign-forecast-service";
import { creatorTierOf } from "./creator-slate";
import { parseFeeAmount } from "./plan-section-utils";
import { resolveCreatorMix } from "./section-data-resolver";

function isBudgetContent(content: unknown): content is BudgetSectionData {
  return (
    typeof content === "object" &&
    content != null &&
    Array.isArray((content as BudgetSectionData).allocations)
  );
}

function sumCreatorFees(cards: SearchCreatorCardItem[]): number {
  let total = 0;
  for (const card of cards) {
    const fee = parseFeeAmount(
      estimateCreatorPostFee({
        followers: card.followers,
        platform: card.platform,
      })
    );
    if (fee != null) total += fee;
    else {
      const tier = creatorTierOf(card).toLowerCase();
      const benchmark =
        tier === "micro" ? 20_000 : tier === "macro" ? 180_000 : tier === "mega" ? 400_000 : 60_000;
      total += benchmark;
    }
  }
  return Math.round(total);
}

function patchCreatorMixActuals(
  campaignObject: CampaignObject,
  actualMix: CreatorMixTier[]
): CampaignObject {
  const strategyData = (campaignObject.sections.strategy.data ?? {}) as StrategySectionData;
  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      strategy: {
        ...campaignObject.sections.strategy,
        data: {
          ...strategyData,
          creatorMixActual: actualMix,
          strategyValidation: {
            tierCoverage:
              actualMix.length > 0
                ? "Slate tier mix updated from applied creator selections."
                : "Awaiting creator slate apply.",
            updatedAt: new Date().toISOString(),
          },
        },
      },
    },
  };
}

function redistributeActivationTimeline(
  campaignObject: CampaignObject,
  cards: SearchCreatorCardItem[],
  mainCreatorIds: Set<string>
): CampaignObject {
  const timelineData = (campaignObject.sections.timeline.data ?? {}) as TimelineSectionExtras;
  const existing = timelineData.creatorActivationTimeline;
  const durationWeeks = existing?.durationWeeks ?? 8;
  const mainCards = cards.filter((c) => mainCreatorIds.has(c.id));

  const activationWeeks = mainCards.map((card, index) => {
    const week = (index % Math.max(durationWeeks - 2, 1)) + 1;
    const tier = creatorTierOf(card);
    return {
      week,
      tier,
      objective: `Wave ${index + 1} · ${card.displayName}`,
      reason: "Redistributed across applied slate after creator review.",
      evidence: "Deterministic post-apply timeline sync.",
      tradeoff: "Validate posting cadence with client before locking.",
      confidence: 0.75,
    };
  });

  const creatorActivationTimeline: CreatorActivationTimeline = {
    activationWeeks,
    reportingPhase: existing?.reportingPhase ?? {
      label: "Reporting & optimization",
      reason: "Measure performance after final creator wave.",
      evidence: "Standard Thinkway activation model.",
    },
    durationWeeks,
  };

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      timeline: {
        ...campaignObject.sections.timeline,
        data: {
          ...timelineData,
          creatorActivationTimeline,
        },
      },
    },
  };
}

function patchBudgetFromSlate(
  campaignObject: CampaignObject,
  cards: SearchCreatorCardItem[]
): CampaignObject {
  const creatorFees = sumCreatorFees(cards);
  const content = campaignObject.sections.budget.content;
  if (!isBudgetContent(content)) return campaignObject;

  const allocations = [...content.allocations];
  const creatorIdx = allocations.findIndex((line) =>
    /creator|influencer|vendor|talent/i.test(line.category)
  );
  const creatorLine = {
    category: "Creator fees",
    amount: creatorFees,
    percent: content.total ? Math.round((creatorFees / content.total) * 100) : undefined,
    notes: `${cards.length} creators on slate — recalculated on apply`,
  };

  if (creatorIdx >= 0) allocations[creatorIdx] = { ...allocations[creatorIdx], ...creatorLine };
  else allocations.unshift(creatorLine);

  const budgetData: BudgetSectionData = { ...content, allocations };
  const strategyText =
    typeof campaignObject.sections.strategy.content === "string"
      ? campaignObject.sections.strategy.content
      : "";
  const riskData: RiskAnalysisSectionData = buildRiskAnalysisFromBudget(budgetData, strategyText);

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      budget: {
        ...campaignObject.sections.budget,
        content: budgetData,
      },
      operations: {
        ...campaignObject.sections.operations,
        content: {
          ...(typeof campaignObject.sections.operations.content === "object" &&
          campaignObject.sections.operations.content != null
            ? campaignObject.sections.operations.content
            : { risks: riskData.risks }),
          risks: riskData.risks,
          overallRiskLevel: riskData.overallRiskLevel,
        },
        data: {
          ...campaignObject.sections.operations.data,
          enrichedRisks: riskData.risks,
        },
      },
    },
  };
}

function patchKpiForecastFromSlate(
  campaignObject: CampaignObject,
  cards: SearchCreatorCardItem[]
): CampaignObject {
  const facts = getCampaignFacts(campaignObject);
  const { snapshot, groundedKpis } = studioForecastArtifacts({ cards, facts });
  const performanceData = (campaignObject.sections.performance.data ?? {}) as PerformanceSectionData;

  const kpiRows = groundedKpis.map((kpi) => ({
    label: kpi.metric,
    target: kpi.prediction,
    projected: kpi.prediction,
    status: "Roster forecast",
    isPercent: kpi.metric.toLowerCase().includes("rate"),
  }));

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      performance: {
        ...campaignObject.sections.performance,
        content: {
          kpis: kpiRows,
          forecastNotes: snapshot.explanation.slice(0, 3).join(" "),
        },
        data: {
          ...performanceData,
          campaignForecast: snapshot,
          groundedKpis,
          kpiForecastNote: `KPI forecast computed from ${cards.length} creator${cards.length === 1 ? "" : "s"} via Campaign Forecast Engine (${snapshot.engineVersion}).`,
        },
      },
    },
  };
}

function patchContentPlanFromSlate(campaignObject: CampaignObject): CampaignObject {
  const timelineData = (campaignObject.sections.timeline.data ?? {}) as TimelineSectionExtras;
  const contentPlan = deriveInfluencerContentPlan(campaignObject);
  if (contentPlan.length === 0) return campaignObject;

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      timeline: {
        ...campaignObject.sections.timeline,
        data: {
          ...timelineData,
          contentPlan,
        },
      },
    },
  };
}

function patchDirectorInsightsFromSlate(
  campaignObject: CampaignObject,
  slateSize: number
): CampaignObject {
  const strategyText =
    typeof campaignObject.sections.strategy.content === "string"
      ? campaignObject.sections.strategy.content
      : "";
  const summaryText =
    typeof campaignObject.sections.summary.content === "string"
      ? campaignObject.sections.summary.content
      : "";
  const budgetText =
    typeof campaignObject.sections.budget.content === "string"
      ? campaignObject.sections.budget.content
      : undefined;
  const strategyData = (campaignObject.sections.strategy.data ?? {}) as StrategySectionData;

  return {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      strategy: {
        ...campaignObject.sections.strategy,
        data: {
          ...strategyData,
          creativeConcepts: deriveCreativeConcepts(strategyText, summaryText),
          whyAiInsights: deriveWhyAiInsights(strategyText, summaryText, budgetText).map(
            (insight, index) =>
              index === 0
                ? {
                    ...insight,
                    rationale: `${insight.rationale} Applied slate: ${slateSize} creator${slateSize === 1 ? "" : "s"}.`,
                  }
                : insight
          ),
        },
      },
    },
  };
}

function factsToActualMix(
  cards: SearchCreatorCardItem[],
  campaignObject: CampaignObject
): CreatorMixTier[] {
  const strategyMix = resolveCreatorMix(campaignObject);
  if (cards.length === 0) return strategyMix;

  const byTier = new Map<string, number>();
  for (const card of cards) {
    const tier = creatorTierOf(card);
    byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
  }
  const total = cards.length;
  return [...byTier.entries()].map(([tier, count]) => ({
    tier: tier as CreatorMixTier["tier"],
    count,
    percent: Math.round((count / total) * 100),
    reasoning: `${count} on slate`,
  }));
}

/**
 * Deterministic dependent-section regeneration after slate apply.
 */
export function regeneratePlanSectionsFromSlate(
  campaignObject: CampaignObject,
  cards: SearchCreatorCardItem[]
): CampaignObject {
  const creatorsData = (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
  const slateIntelligence = creatorsData.slateIntelligence;
  const actualMix = slateIntelligence?.actualMix ?? factsToActualMix(cards, campaignObject);

  const mainIds = new Set(
    (slateIntelligence?.recommendations ?? [])
      .filter((rec) => rec.role === "main")
      .map((rec) => rec.creatorId)
  );
  if (mainIds.size === 0) {
    for (const card of cards) mainIds.add(card.id);
  }

  let next = patchCreatorMixActuals(campaignObject, actualMix);
  next = redistributeActivationTimeline(next, cards, mainIds);
  next = patchBudgetFromSlate(next, cards);
  next = patchKpiForecastFromSlate(next, cards);
  next = patchContentPlanFromSlate(next);
  next = patchDirectorInsightsFromSlate(next, cards.length);
  return next;
}

export function groundedCreatorToSearchCard(
  creator: import("@/features/ai-workflows/formatters/creator-formatter").GroundedCreator
): SearchCreatorCardItem {
  return {
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    platform: creator.platform,
    followers: creator.followers,
    engagementRate: creator.engagementRate,
    avatarUrl: creator.avatarUrl,
    profileUrl: creator.profileUrl,
    campaignRelevanceScore: creator.campaignRelevanceScore,
    categories: creator.categories,
  };
}
