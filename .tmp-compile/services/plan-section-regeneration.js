import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import { getStrategyFromWorkflowData } from "@/features/campaign-director/services/campaign-director";
import { buildKpiForecastFromStrategy, buildRiskAnalysisFromBudget, } from "@/features/campaign-intelligence/services/structured-section-builders";
import { deriveContentPlan, deriveCreativeConcepts, deriveWhyAiInsights, } from "@/features/campaign-studio/services/presentation-intelligence";
import { creatorTierOf } from "./creator-slate";
import { parseFeeAmount } from "./plan-section-utils";
import { resolveCreatorMix } from "./section-data-resolver";
function isBudgetContent(content) {
    return (typeof content === "object" &&
        content != null &&
        Array.isArray(content.allocations));
}
function sumCreatorFees(cards) {
    let total = 0;
    for (const card of cards) {
        const fee = parseFeeAmount(card.priceEstimate);
        if (fee != null)
            total += fee;
        else {
            const tier = creatorTierOf(card).toLowerCase();
            const benchmark = tier === "micro" ? 20000 : tier === "macro" ? 180000 : tier === "mega" ? 400000 : 60000;
            total += benchmark;
        }
    }
    return Math.round(total);
}
function patchCreatorMixActuals(campaignObject, actualMix) {
    const strategyData = (campaignObject.sections.strategy.data ?? {});
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
                        tierCoverage: actualMix.length > 0
                            ? "Slate tier mix updated from applied creator selections."
                            : "Awaiting creator slate apply.",
                        updatedAt: new Date().toISOString(),
                    },
                },
            },
        },
    };
}
function redistributeActivationTimeline(campaignObject, cards, mainCreatorIds) {
    const timelineData = (campaignObject.sections.timeline.data ?? {});
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
    const creatorActivationTimeline = {
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
function patchBudgetFromSlate(campaignObject, cards) {
    const creatorFees = sumCreatorFees(cards);
    const content = campaignObject.sections.budget.content;
    if (!isBudgetContent(content))
        return campaignObject;
    const allocations = [...content.allocations];
    const creatorIdx = allocations.findIndex((line) => /creator|influencer|vendor|talent/i.test(line.category));
    const creatorLine = {
        category: "Creator fees",
        amount: creatorFees,
        percent: content.total ? Math.round((creatorFees / content.total) * 100) : undefined,
        notes: `${cards.length} creators on slate — recalculated on apply`,
    };
    if (creatorIdx >= 0)
        allocations[creatorIdx] = { ...allocations[creatorIdx], ...creatorLine };
    else
        allocations.unshift(creatorLine);
    const budgetData = { ...content, allocations };
    const strategyText = typeof campaignObject.sections.strategy.content === "string"
        ? campaignObject.sections.strategy.content
        : "";
    const riskData = buildRiskAnalysisFromBudget(budgetData, strategyText);
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
function patchKpiForecastFromSlate(campaignObject, slateSize) {
    const strategyText = typeof campaignObject.sections.strategy.content === "string"
        ? campaignObject.sections.strategy.content
        : "";
    const summaryText = typeof campaignObject.sections.summary.content === "string"
        ? campaignObject.sections.summary.content
        : "";
    const facts = getCampaignFacts(campaignObject);
    const strategy = getStrategyFromWorkflowData(campaignObject.meta);
    const kpiData = buildKpiForecastFromStrategy(strategyText, facts, strategy);
    const performanceData = (campaignObject.sections.performance.data ?? {});
    return {
        ...campaignObject,
        sections: {
            ...campaignObject.sections,
            performance: {
                ...campaignObject.sections.performance,
                content: kpiData,
                data: {
                    ...performanceData,
                    kpiForecastNote: `KPI forecast refreshed for ${slateSize} creator${slateSize === 1 ? "" : "s"} on the applied slate.`,
                },
            },
        },
    };
}
function patchContentPlanFromSlate(campaignObject) {
    const strategyText = typeof campaignObject.sections.strategy.content === "string"
        ? campaignObject.sections.strategy.content
        : "";
    const summaryText = typeof campaignObject.sections.summary.content === "string"
        ? campaignObject.sections.summary.content
        : "";
    const timelineData = (campaignObject.sections.timeline.data ?? {});
    return {
        ...campaignObject,
        sections: {
            ...campaignObject.sections,
            timeline: {
                ...campaignObject.sections.timeline,
                data: {
                    ...timelineData,
                    contentPlan: deriveContentPlan(strategyText, summaryText),
                },
            },
        },
    };
}
function patchDirectorInsightsFromSlate(campaignObject, slateSize) {
    const strategyText = typeof campaignObject.sections.strategy.content === "string"
        ? campaignObject.sections.strategy.content
        : "";
    const summaryText = typeof campaignObject.sections.summary.content === "string"
        ? campaignObject.sections.summary.content
        : "";
    const budgetText = typeof campaignObject.sections.budget.content === "string"
        ? campaignObject.sections.budget.content
        : undefined;
    const strategyData = (campaignObject.sections.strategy.data ?? {});
    return {
        ...campaignObject,
        sections: {
            ...campaignObject.sections,
            strategy: {
                ...campaignObject.sections.strategy,
                data: {
                    ...strategyData,
                    creativeConcepts: deriveCreativeConcepts(strategyText, summaryText),
                    whyAiInsights: deriveWhyAiInsights(strategyText, summaryText, budgetText).map((insight, index) => index === 0
                        ? {
                            ...insight,
                            rationale: `${insight.rationale} Applied slate: ${slateSize} creator${slateSize === 1 ? "" : "s"}.`,
                        }
                        : insight),
                },
            },
        },
    };
}
function factsToActualMix(cards, campaignObject) {
    const strategyMix = resolveCreatorMix(campaignObject);
    if (cards.length === 0)
        return strategyMix;
    const byTier = new Map();
    for (const card of cards) {
        const tier = creatorTierOf(card);
        byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
    }
    const total = cards.length;
    return [...byTier.entries()].map(([tier, count]) => ({
        tier: tier,
        count,
        percent: Math.round((count / total) * 100),
        reasoning: `${count} on slate`,
    }));
}
/**
 * Deterministic dependent-section regeneration after slate apply.
 */
export function regeneratePlanSectionsFromSlate(campaignObject, cards) {
    const creatorsData = (campaignObject.sections.creators.data ?? {});
    const slateIntelligence = creatorsData.slateIntelligence;
    const actualMix = slateIntelligence?.actualMix ?? factsToActualMix(cards, campaignObject);
    const mainIds = new Set((slateIntelligence?.recommendations ?? [])
        .filter((rec) => rec.role === "main")
        .map((rec) => rec.creatorId));
    if (mainIds.size === 0) {
        for (const card of cards)
            mainIds.add(card.id);
    }
    let next = patchCreatorMixActuals(campaignObject, actualMix);
    next = redistributeActivationTimeline(next, cards, mainIds);
    next = patchBudgetFromSlate(next, cards);
    next = patchKpiForecastFromSlate(next, cards.length);
    next = patchContentPlanFromSlate(next);
    next = patchDirectorInsightsFromSlate(next, cards.length);
    return next;
}
export function groundedCreatorToSearchCard(creator) {
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
    };
}
