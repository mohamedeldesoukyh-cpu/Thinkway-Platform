/**
 * Thinkway Score — Budget 20, Creator Fit 25, Audience 20, Risk 15, Timeline 10, KPIs 10.
 */

import type {
  CampaignDecisionContext,
  SimulationResult,
  ThinkwayScoreBreakdown,
  THINKWAY_SCORE_WEIGHTS,
} from "./decision-types";

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

function scoreBudget(baseline: CampaignDecisionContext, result: SimulationResult): number {
  const change = result.budget.percentChange ?? 0;
  const total = result.budget.total;
  const baselineTotal = baseline.budget.total;

  if (baselineTotal <= 0) return 50;

  const efficiency = result.kpis.reach / Math.max(total, 1);
  const baselineEfficiency = baseline.kpis.reach / baselineTotal;
  const efficiencyRatio = efficiency / Math.max(baselineEfficiency, 0.0001);

  let score = 70;
  if (change < 0) {
    score = 60 + efficiencyRatio * 15;
  } else if (change > 0) {
    score = 65 + Math.min(25, change / 2);
  } else {
    score = 72 + efficiencyRatio * 10;
  }

  return clampScore(score);
}

function scoreCreatorFit(result: SimulationResult): number {
  if (result.creators.length === 0) return 40;
  const avgFit =
    result.creators.reduce((sum, c) => sum + c.fitScore, 0) / result.creators.length;
  const clientPenalty = result.creators.some((c) => c.source === "client") ? 5 : 0;
  return clampScore(avgFit - clientPenalty);
}

function scoreAudience(baseline: CampaignDecisionContext, result: SimulationResult): number {
  const reachRatio = result.kpis.reach / Math.max(baseline.kpis.reach, 1);
  const erDelta = result.kpis.engagementRate - baseline.kpis.engagementRate;
  return clampScore(60 + reachRatio * 25 + erDelta * 3);
}

function scoreRisk(baseline: CampaignDecisionContext, result: SimulationResult): number {
  const riskDelta = result.risk.score - baseline.risk.score;
  const highRiskPenalty = result.risk.highRiskCount * 8;
  return clampScore(result.risk.score + riskDelta * 0.2 - highRiskPenalty);
}

function scoreTimeline(baseline: CampaignDecisionContext, result: SimulationResult): number {
  const weeks = result.timeline.durationWeeks;
  const baselineWeeks = baseline.timeline.durationWeeks;
  const optimal = baselineWeeks;
  const deviation = Math.abs(weeks - optimal);
  return clampScore(85 - deviation * 5);
}

function scoreKpis(baseline: CampaignDecisionContext, result: SimulationResult): number {
  const reachDelta =
    ((result.kpis.reach - baseline.kpis.reach) / Math.max(baseline.kpis.reach, 1)) * 100;
  const conversionDelta =
    ((result.kpis.conversions - baseline.kpis.conversions) /
      Math.max(baseline.kpis.conversions, 1)) *
    100;
  return clampScore(55 + reachDelta * 0.15 + conversionDelta * 0.2);
}

export function computeThinkwayScore(
  baseline: CampaignDecisionContext,
  result: SimulationResult
): ThinkwayScoreBreakdown {
  const weights = {
    budget: 20,
    creatorFit: 25,
    audience: 20,
    risk: 15,
    timeline: 10,
    kpis: 10,
  } satisfies typeof THINKWAY_SCORE_WEIGHTS;

  const budget = scoreBudget(baseline, result);
  const creatorFit = scoreCreatorFit(result);
  const audience = scoreAudience(baseline, result);
  const risk = scoreRisk(baseline, result);
  const timeline = scoreTimeline(baseline, result);
  const kpis = scoreKpis(baseline, result);

  const total = Math.round(
    (budget * weights.budget +
      creatorFit * weights.creatorFit +
      audience * weights.audience +
      risk * weights.risk +
      timeline * weights.timeline +
      kpis * weights.kpis) /
      100
  );

  return { budget, creatorFit, audience, risk, timeline, kpis, total: clampScore(total) };
}

export function compareThinkwayScores(
  before: ThinkwayScoreBreakdown,
  after: ThinkwayScoreBreakdown
): number {
  return after.total - before.total;
}
