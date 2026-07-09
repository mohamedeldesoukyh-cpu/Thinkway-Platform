/**
 * KPI simulator — recalculates reach, engagement, CPM, ROAS, conversions.
 */

import type {
  CampaignDecisionContext,
  KpiDelta,
  KpiSnapshot,
  SimulationCreator,
} from "./decision-types";

export type KpiSimulationInput = {
  budgetMultiplier: number;
  creatorCount: number;
  postCount: number;
  creators: SimulationCreator[];
  timelineWeeks?: number;
  baselineTimelineWeeks?: number;
  riskScore?: number;
  baselineRiskScore?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeCreatorWeightedReach(creators: SimulationCreator[]): number {
  return creators.reduce((sum, c) => {
    const platformMultiplier = c.platform === "tiktok" ? 0.55 : c.platform === "youtube" ? 0.4 : 0.35;
    return sum + c.followers * c.postCount * platformMultiplier;
  }, 0);
}

function computeCreatorWeightedEngagement(creators: SimulationCreator[], reach: number): number {
  if (creators.length === 0) return reach * 0.04;
  const avgEr =
    creators.reduce((sum, c) => sum + c.engagementRate, 0) / creators.length / 100;
  return Math.round(reach * avgEr);
}

function computeAvgCpm(creators: SimulationCreator[], budgetTotal: number, reach: number): number {
  if (reach <= 0) return 50;
  const creatorCpm =
    creators.length > 0
      ? creators.reduce((sum, c) => sum + c.cpm, 0) / creators.length
      : (budgetTotal / reach) * 1000;
  return Math.round(creatorCpm * 10) / 10;
}

export function simulateKpis(
  baseline: CampaignDecisionContext,
  input: KpiSimulationInput
): { kpis: KpiSnapshot; kpiDeltas: KpiDelta[] } {
  const {
    budgetMultiplier,
    creatorCount,
    postCount,
    creators,
    timelineWeeks = baseline.timeline.durationWeeks,
    baselineTimelineWeeks = baseline.timeline.durationWeeks,
    riskScore = baseline.risk.score,
    baselineRiskScore = baseline.risk.score,
  } = input;

  const creatorReach = computeCreatorWeightedReach(creators);
  const budgetReach = baseline.kpis.reach * budgetMultiplier;
  const reach = Math.round(Math.max(creatorReach, budgetReach));

  const engagement = computeCreatorWeightedEngagement(creators, reach);
  const engagementRate =
    reach > 0 ? Math.round((engagement / reach) * 10000) / 100 : baseline.kpis.engagementRate;

  const budgetTotal = Math.round(baseline.budget.total * budgetMultiplier);
  const cpm = computeAvgCpm(creators, budgetTotal, reach);
  const cpe = Math.round(cpm * 0.15 * 100) / 100;

  const timelineFactor = timelineWeeks / Math.max(baselineTimelineWeeks, 1);
  const riskFactor = riskScore / Math.max(baselineRiskScore, 1);
  const conversionBase = baseline.kpis.conversions * budgetMultiplier;
  const conversions = Math.round(conversionBase * timelineFactor * clamp(riskFactor, 0.7, 1.2));

  const awareness = clamp(
    Math.round(baseline.kpis.awareness * Math.sqrt(budgetMultiplier) * 10) / 10,
    0,
    100
  );

  const roas = clamp(
    Math.round(baseline.kpis.roas * (budgetMultiplier >= 1 ? 1 + (budgetMultiplier - 1) * 0.3 : budgetMultiplier) * 10) / 10,
    0.5,
    10
  );

  const kpis: KpiSnapshot = {
    reach,
    engagement,
    engagementRate,
    impressions: reach,
    awareness,
    cpm,
    cpe,
    roas,
    conversions,
    creatorCount,
    postCount,
  };

  const kpiDeltas = buildKpiDeltas(baseline.kpis, kpis);
  return { kpis, kpiDeltas };
}

export function buildKpiDeltas(before: KpiSnapshot, after: KpiSnapshot): KpiDelta[] {
  const keys = Object.keys(before) as (keyof KpiSnapshot)[];
  return keys.map((metric) => {
    const b = before[metric];
    const a = after[metric];
    const percentChange = b === 0 ? (a === 0 ? 0 : 100) : Math.round(((a - b) / b) * 1000) / 10;
    return { metric, before: b, after: a, percentChange };
  });
}

export function formatKpiImpact(deltas: KpiDelta[]): Record<string, number> {
  const impact: Record<string, number> = {};
  for (const delta of deltas) {
    if (["reach", "engagement", "awareness", "cpm", "conversions"].includes(delta.metric)) {
      impact[delta.metric] = delta.percentChange;
    }
  }
  return impact;
}
