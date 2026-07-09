/**
 * Recommendation engine — structured recommendations with reason, confidence, impact, alternatives.
 */

import type {
  CampaignDecisionContext,
  CampaignScenario,
  DecisionCard,
  ScenarioChanges,
  SimulationResult,
  StructuredRecommendation,
  ThinkwayScoreBreakdown,
} from "./decision-types";
import { budgetDecisionReason } from "./budget-simulator";
import { formatKpiImpact } from "./kpi-simulator";
import { compareThinkwayScores } from "./decision-score";

let recommendationCounter = 0;

function nextId(prefix: string): string {
  recommendationCounter += 1;
  return `${prefix}_${recommendationCounter}`;
}

function priorityFromImpact(scoreDelta: number): StructuredRecommendation["priority"] {
  if (scoreDelta >= 8) return "critical";
  if (scoreDelta >= 4) return "high";
  if (scoreDelta >= 0) return "medium";
  return "low";
}

function buildBudgetRecommendation(
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges,
  result: SimulationResult,
  scoreBefore: ThinkwayScoreBreakdown,
  scoreAfter: ThinkwayScoreBreakdown
): StructuredRecommendation | null {
  const percentChange = changes.budgetChange?.percentChange;
  if (percentChange == null || percentChange === 0) return null;

  const scoreDelta = compareThinkwayScores(scoreBefore, scoreAfter);
  const reachDelta = result.kpiDeltas.find((d) => d.metric === "reach");

  return {
    id: nextId("rec_budget"),
    title: percentChange < 0 ? `Reduce budget by ${Math.abs(percentChange)}%` : `Increase budget by ${percentChange}%`,
    reason: budgetDecisionReason(percentChange, baseline),
    confidence: Math.min(92, 70 + Math.abs(percentChange) * 0.5),
    impact: {
      summary: `Reach ${reachDelta?.percentChange ?? 0}% · Thinkway Score ${scoreDelta >= 0 ? "+" : ""}${scoreDelta}`,
      kpiDeltas: result.kpiDeltas.filter((d) =>
        ["reach", "engagement", "cpm", "conversions"].includes(d.metric)
      ),
      scoreDelta,
    },
    pros:
      percentChange < 0
        ? ["Preserves core campaign structure", "Reduces financial exposure", "Maintains creator relationships"]
        : ["Expands reach potential", "Enables additional creator tiers", "Improves conversion headroom"],
    cons:
      percentChange < 0
        ? ["Lower reach and engagement", "Reduced creator pool", "May miss KPI targets"]
        : ["Higher spend required", "Longer approval cycle", "Diminishing returns at high increases"],
    alternative: {
      title: percentChange < 0 ? "Maintain budget, optimize creator mix" : "Phased budget release",
      description:
        percentChange < 0
          ? "Keep current budget but replace lower-fit creators with higher-ER alternatives."
          : "Release incremental budget in two tranches tied to mid-campaign KPI gates.",
      tradeoffs: ["Requires creator renegotiation", "Timeline may extend by 1 week"],
    },
    priority: priorityFromImpact(scoreDelta),
    category: "budget",
  };
}

function buildCreatorRecommendation(
  baseline: CampaignDecisionContext,
  result: SimulationResult,
  scoreBefore: ThinkwayScoreBreakdown,
  scoreAfter: ThinkwayScoreBreakdown
): StructuredRecommendation | null {
  const clientCreators = result.creators.filter((c) => c.source === "client");
  if (clientCreators.length === 0) return null;

  const avgFit =
    clientCreators.reduce((sum, c) => sum + c.fitScore, 0) / clientCreators.length;
  const thinkwayAvg =
    baseline.creators.reduce((sum, c) => sum + c.fitScore, 0) /
    Math.max(baseline.creators.length, 1);

  const scoreDelta = compareThinkwayScores(scoreBefore, scoreAfter);

  return {
    id: nextId("rec_creator"),
    title: avgFit < thinkwayAvg ? "Replace client creators with Thinkway recommendations" : "Retain client creator selections",
    reason:
      avgFit < thinkwayAvg
        ? `Client creator average fit (${avgFit.toFixed(0)}) is below Thinkway baseline (${thinkwayAvg.toFixed(0)}). DNA hydration confirms audience and ER gaps.`
        : `Client creators meet fit threshold. Average fit ${avgFit.toFixed(0)} vs Thinkway ${thinkwayAvg.toFixed(0)}.`,
    confidence: avgFit < thinkwayAvg ? 78 : 85,
    impact: {
      summary: `Creator fit ${avgFit.toFixed(0)} · Score delta ${scoreDelta >= 0 ? "+" : ""}${scoreDelta}`,
      kpiDeltas: result.kpiDeltas.filter((d) => d.metric === "engagementRate" || d.metric === "cpm"),
      scoreDelta,
    },
    pros: avgFit < thinkwayAvg
      ? ["Higher engagement rate", "Better audience alignment", "Lower CPM efficiency"]
      : ["Client relationship preserved", "Faster approval", "Brand familiarity"],
    cons: avgFit < thinkwayAvg
      ? ["Client pushback risk", "Re-briefing required"]
      : ["Potentially lower ER", "Higher CPM vs optimized mix"],
    alternative: {
      title: "Hybrid mix — retain 1 client creator, swap others",
      description: "Keep highest-fit client creator for relationship continuity; replace remaining slots with Thinkway picks.",
      tradeoffs: ["Partial client satisfaction", "Moderate KPI improvement"],
    },
    priority: avgFit < thinkwayAvg - 5 ? "high" : "medium",
    category: "creator",
  };
}

function buildRiskRecommendation(
  baseline: CampaignDecisionContext,
  result: SimulationResult
): StructuredRecommendation | null {
  if (result.risk.level !== "high" && result.risk.highRiskCount <= baseline.risk.highRiskCount) {
    return null;
  }

  return {
    id: nextId("rec_risk"),
    title: "Mitigate elevated campaign risk",
    reason: `Risk score dropped to ${result.risk.score}. Factors: ${result.risk.factors.slice(0, 2).join("; ")}.`,
    confidence: 82,
    impact: {
      summary: `${result.risk.highRiskCount} high-risk factors identified`,
    },
    pros: ["Prevents budget waste", "Improves approval confidence"],
    cons: ["May require timeline extension", "Additional compliance review"],
    alternative: {
      title: "Reduce scope instead of full mitigation",
      description: "Cut 1 creator tier and extend timeline by 1 week to absorb risk without full replan.",
      tradeoffs: ["Lower reach", "Simpler execution"],
    },
    priority: result.risk.level === "high" ? "critical" : "high",
    category: "risk",
  };
}

export function generateRecommendations(
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges,
  result: SimulationResult,
  scoreBefore: ThinkwayScoreBreakdown,
  scoreAfter: ThinkwayScoreBreakdown
): StructuredRecommendation[] {
  const recs: StructuredRecommendation[] = [];

  const budgetRec = buildBudgetRecommendation(baseline, changes, result, scoreBefore, scoreAfter);
  if (budgetRec) recs.push(budgetRec);

  const creatorRec = buildCreatorRecommendation(baseline, result, scoreBefore, scoreAfter);
  if (creatorRec) recs.push(creatorRec);

  const riskRec = buildRiskRecommendation(baseline, result);
  if (riskRec) recs.push(riskRec);

  if (recs.length === 0) {
    recs.push({
      id: nextId("rec_baseline"),
      title: "Proceed with current plan",
      reason: "No significant deltas detected. Baseline scenario meets Thinkway thresholds.",
      confidence: 88,
      impact: { summary: "Score stable" },
      pros: ["Fastest time to launch", "Approved structure intact"],
      cons: ["No optimization applied"],
      alternative: {
        title: "Run A/B creator test",
        description: "Split 20% budget to test alternative creator mix before full commit.",
        tradeoffs: ["2-week delay", "Additional analytics setup"],
      },
      priority: "low",
      category: "kpi",
    });
  }

  return recs;
}

export function buildDecisionCards(
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges,
  result: SimulationResult,
  scenarioName: string
): DecisionCard[] {
  const cards: DecisionCard[] = [];
  const impact = formatKpiImpact(result.kpiDeltas);

  if (changes.budgetChange) {
    const pct = changes.budgetChange.percentChange;
    cards.push({
      id: nextId("card_budget"),
      decision: pct < 0 ? "Reduce budget" : pct > 0 ? "Increase budget" : "Maintain budget",
      current: {
        total: baseline.budget.total,
        currency: baseline.budget.currency,
        reach: baseline.kpis.reach,
      },
      suggested: {
        total: result.budget.total,
        currency: result.budget.currency,
        reach: result.kpis.reach,
      },
      impact: {
        reach: impact.reach,
        engagement: impact.engagement,
        awareness: impact.awareness,
        cpm: impact.cpm,
        conversions: impact.conversions,
      },
      confidence: Math.min(90, 72 + Math.abs(pct) * 0.4),
      reason: budgetDecisionReason(pct, baseline),
    });
  }

  if (changes.creatorChanges?.length) {
    cards.push({
      id: nextId("card_creator"),
      decision: scenarioName.includes("Client") ? "Apply client creator mix" : "Adjust creator mix",
      current: {
        creatorCount: baseline.kpis.creatorCount,
        avgFit: Math.round(
          baseline.creators.reduce((s, c) => s + c.fitScore, 0) / Math.max(baseline.creators.length, 1)
        ),
      },
      suggested: {
        creatorCount: result.kpis.creatorCount,
        avgFit: Math.round(
          result.creators.reduce((s, c) => s + c.fitScore, 0) / Math.max(result.creators.length, 1)
        ),
      },
      impact: {
        reach: impact.reach,
        engagement: impact.engagement,
        cpm: impact.cpm,
      },
      confidence: 76,
      reason: `Creator mix changed from ${baseline.creators.length} to ${result.creators.length} creators.`,
    });
  }

  return cards;
}

export function aggregateRecommendations(scenarios: CampaignScenario[]): StructuredRecommendation[] {
  const byTitle = new Map<string, StructuredRecommendation>();

  for (const scenario of scenarios) {
    for (const rec of scenario.recommendations) {
      const existing = byTitle.get(rec.title);
      if (!existing || rec.confidence > existing.confidence) {
        byTitle.set(rec.title, rec);
      }
    }
  }

  return [...byTitle.values()].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function validateRecommendationStructure(rec: StructuredRecommendation): string[] {
  const errors: string[] = [];
  if (!rec.reason) errors.push("missing reason");
  if (rec.confidence == null || rec.confidence < 0) errors.push("missing confidence");
  if (!rec.impact?.summary) errors.push("missing impact");
  if (!rec.alternative?.title) errors.push("missing alternative");
  if (!rec.pros?.length) errors.push("missing pros");
  if (!rec.cons?.length) errors.push("missing cons");
  return errors;
}
