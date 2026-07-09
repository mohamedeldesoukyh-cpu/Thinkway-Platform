/**
 * Scenario engine — unlimited scenarios storing deltas only.
 */

import type { CreatorDNADocument } from "@/features/creator-dna/types";

import type {
  CampaignDecisionContext,
  CampaignScenario,
  ScenarioChanges,
  ScenarioComparison,
  ScenarioComparisonRow,
  SimulationResult,
  SimulationRisk,
  SimulationTimeline,
} from "./decision-types";
import { applyBudgetDelta } from "./budget-simulator";
import { simulateCreatorChanges } from "./creator-simulator";
import { simulateKpis } from "./kpi-simulator";
import { computeThinkwayScore } from "./decision-score";
import {
  buildDecisionCards,
  generateRecommendations,
} from "./recommendation-engine";

let scenarioCounter = 0;

function nextScenarioId(): string {
  scenarioCounter += 1;
  return `scenario_${scenarioCounter}_${Date.now()}`;
}

export function resetScenarioCounter(): void {
  scenarioCounter = 0;
}

function applyTimelineChanges(
  baseline: SimulationTimeline,
  changes: ScenarioChanges["timelineChanges"]
): SimulationTimeline {
  if (!changes) return { ...baseline };
  return {
    durationWeeks: Math.max(1, baseline.durationWeeks + (changes.durationWeeksDelta ?? 0)),
    goLiveWeek: Math.max(1, baseline.goLiveWeek + (changes.goLiveWeekDelta ?? 0)),
  };
}

function computeScenarioRisk(
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges,
  creators: SimulationResult["creators"]
): SimulationRisk {
  let score = baseline.risk.score;
  let highRiskCount = baseline.risk.highRiskCount;
  const factors = [...baseline.risk.factors];

  if (changes.budgetChange && changes.budgetChange.percentChange <= -20) {
    score -= 10;
    highRiskCount += 1;
    factors.push("Significant budget reduction may miss KPI targets");
  }

  const clientCreators = creators.filter((c) => c.source === "client");
  if (clientCreators.length > 0) {
    const lowFit = clientCreators.filter((c) => c.fitScore < 65);
    if (lowFit.length > 0) {
      score -= lowFit.length * 5;
      highRiskCount += 1;
      factors.push(`${lowFit.length} client creator(s) below fit threshold`);
    }
  }

  if (changes.timelineChanges?.durationWeeksDelta && changes.timelineChanges.durationWeeksDelta < 0) {
    score -= 8;
    factors.push("Compressed timeline increases delivery risk");
  }

  const level: SimulationRisk["level"] =
    score >= 75 ? "low" : score >= 55 ? "medium" : "high";

  return {
    level,
    score: Math.max(0, Math.min(100, score)),
    highRiskCount,
    factors: factors.slice(0, 6),
  };
}

function computeSuccessProbability(
  baseline: CampaignDecisionContext,
  thinkwayScore: number,
  risk: SimulationRisk
): number {
  const base = baseline.successProbability;
  const scoreFactor = (thinkwayScore - 70) * 0.3;
  const riskFactor = (risk.score - 70) * 0.2;
  return Math.round(Math.min(98, Math.max(20, base + scoreFactor + riskFactor)));
}

/** Combine immutable baseline context + deltas → full simulation result. */
export function simulateScenario(
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges,
  dnaMap?: Map<string, CreatorDNADocument>
): SimulationResult {
  const budgetPercent = changes.budgetChange?.percentChange ?? 0;
  const budget = applyBudgetDelta(baseline.budget, budgetPercent);

  const creatorSim = simulateCreatorChanges(baseline, changes, dnaMap);
  let creators = creatorSim.creators;
  let kpis = creatorSim.kpis;
  let kpiDeltas = creatorSim.kpiDeltas;

  const timeline = applyTimelineChanges(baseline.timeline, changes.timelineChanges);

  if (changes.timelineChanges || changes.platformChanges) {
    const budgetMultiplier = 1 + budgetPercent / 100;
    const sim = simulateKpis(baseline, {
      budgetMultiplier,
      creatorCount: creators.length,
      postCount: creators.reduce((s, c) => s + c.postCount, 0),
      creators,
      timelineWeeks: timeline.durationWeeks,
      baselineTimelineWeeks: baseline.timeline.durationWeeks,
    });
    kpis = sim.kpis;
    kpiDeltas = sim.kpiDeltas;
  }

  const risk = computeScenarioRisk(baseline, changes, creators);

  const baselineScore = computeThinkwayScore(baseline, {
    budget: baseline.budget,
    kpis: baseline.kpis,
    kpiDeltas: [],
    creators: baseline.creators,
    timeline: baseline.timeline,
    risk: baseline.risk,
    successProbability: baseline.successProbability,
  });

  const provisionalResult: SimulationResult = {
    budget,
    kpis,
    kpiDeltas,
    creators,
    timeline,
    risk,
    successProbability: baseline.successProbability,
  };

  const thinkwayScore = computeThinkwayScore(baseline, provisionalResult);
  const successProbability = computeSuccessProbability(baseline, thinkwayScore.total, risk);

  return { ...provisionalResult, successProbability };
}

export function createScenario(
  name: string,
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges,
  dnaMap?: Map<string, CreatorDNADocument>
): CampaignScenario {
  const baselineResult: SimulationResult = {
    budget: baseline.budget,
    kpis: baseline.kpis,
    kpiDeltas: [],
    creators: baseline.creators,
    timeline: baseline.timeline,
    risk: baseline.risk,
    successProbability: baseline.successProbability,
  };

  const baselineScore = computeThinkwayScore(baseline, baselineResult);
  const simulationResult = simulateScenario(baseline, changes, dnaMap);
  const thinkwayScore = computeThinkwayScore(baseline, simulationResult);
  const recommendations = generateRecommendations(
    baseline,
    changes,
    simulationResult,
    baselineScore,
    thinkwayScore
  );
  const decisionCards = buildDecisionCards(baseline, changes, simulationResult, name);

  return {
    id: nextScenarioId(),
    name,
    parentCampaignObjectId: baseline.campaignObjectId,
    changes,
    simulationResult,
    thinkwayScore,
    recommendations,
    decisionCards,
    createdAt: new Date().toISOString(),
  };
}

export function createOriginalScenario(baseline: CampaignDecisionContext): CampaignScenario {
  return createScenario("Original", baseline, {});
}

export function buildStandardScenarios(
  baseline: CampaignDecisionContext,
  dnaMap?: Map<string, CreatorDNADocument>,
  clientCreatorIds?: string[]
): CampaignScenario[] {
  const scenarios: CampaignScenario[] = [];

  scenarios.push(createOriginalScenario(baseline));

  scenarios.push(
    createScenario("Client Budget Cut", baseline, {
      budgetChange: { percentChange: -20, label: "Budget -20%" },
    }, dnaMap)
  );

  scenarios.push(
    createScenario("Budget +20%", baseline, {
      budgetChange: { percentChange: 20, label: "Budget +20%" },
    }, dnaMap)
  );

  if (clientCreatorIds?.length) {
    const creatorChanges = baseline.creators.map((creator, index) => ({
      action: "replace" as const,
      creatorId: creator.id,
      replacementCreatorId: clientCreatorIds[index] ?? clientCreatorIds[0],
      source: "client" as const,
    }));

    scenarios.push(
      createScenario("Client Creators", baseline, { creatorChanges }, dnaMap)
    );
  } else {
    scenarios.push(
      createScenario("Client Creators", baseline, {
        creatorChanges: baseline.creators.map((c) => ({
          action: "replace" as const,
          creatorId: c.id,
          replacementCreatorId: `client_${c.id}`,
          source: "client" as const,
        })),
      }, dnaMap)
    );
  }

  scenarios.push(
    createScenario("Alternative Mix", baseline, {
      creatorChanges: [
        ...(baseline.creators.length > 1
          ? [{ action: "remove" as const, creatorId: baseline.creators[0].id }]
          : []),
        { action: "add" as const, creatorId: "alt_creator_premium", source: "thinkway" as const },
      ],
      budgetChange: { percentChange: -5, label: "Efficiency reallocation" },
    }, dnaMap)
  );

  scenarios.push(
    createScenario("Sales Objective", baseline, {
      objectiveChanges: { objective: "Conversions and sales", campaignType: "Performance" },
      budgetChange: { percentChange: 10, label: "Performance uplift" },
    }, dnaMap)
  );

  scenarios.push(
    createScenario("Luxury Positioning", baseline, {
      creatorChanges: baseline.creators.map((c) => ({
        action: "switch_platform" as const,
        creatorId: c.id,
        targetPlatform: "instagram",
      })),
      budgetChange: { percentChange: 15, label: "Premium positioning" },
    }, dnaMap)
  );

  return scenarios;
}

const EMPTY_SCENARIO_COMPARISON: ScenarioComparison = {
  baselineScenarioId: "",
  rows: [],
  winnerScenarioId: "",
};

export function compareScenarios(
  scenarios: CampaignScenario[],
  baselineScenarioId?: string
): ScenarioComparison {
  if (scenarios.length === 0) {
    return { ...EMPTY_SCENARIO_COMPARISON, baselineScenarioId: baselineScenarioId ?? "" };
  }

  const baseline = scenarios.find((s) => s.name === "Original") ?? scenarios[0];
  const baselineId = baselineScenarioId ?? baseline.id;

  const rows: ScenarioComparisonRow[] = scenarios.map((scenario) => {
    const r = scenario.simulationResult;
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      budget: r.budget.total,
      reach: r.kpis.reach,
      engagement: r.kpis.engagement,
      conversions: r.kpis.conversions,
      cpm: r.kpis.cpm,
      creatorCount: r.kpis.creatorCount,
      postCount: r.kpis.postCount,
      riskScore: r.risk.score,
      timelineWeeks: r.timeline.durationWeeks,
      thinkwayScore: scenario.thinkwayScore.total,
      successProbability: r.successProbability,
      isWinner: false,
    };
  });

  let winnerIdx = 0;
  let bestScore = -1;
  rows.forEach((row, idx) => {
    const composite = row.thinkwayScore * 0.6 + row.successProbability * 0.4;
    if (composite > bestScore) {
      bestScore = composite;
      winnerIdx = idx;
    }
  });
  rows[winnerIdx].isWinner = true;

  return {
    baselineScenarioId: baselineId,
    rows,
    winnerScenarioId: rows[winnerIdx].scenarioId,
  };
}

/** In-memory scenario store — deltas only, no CampaignObject persistence. */
export class ScenarioStore {
  private scenarios = new Map<string, CampaignScenario>();

  add(scenario: CampaignScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  get(id: string): CampaignScenario | undefined {
    return this.scenarios.get(id);
  }

  list(): CampaignScenario[] {
    return [...this.scenarios.values()];
  }

  listByCampaign(campaignObjectId: string): CampaignScenario[] {
    return this.list().filter((s) => s.parentCampaignObjectId === campaignObjectId);
  }

  clear(): void {
    this.scenarios.clear();
  }

  size(): number {
    return this.scenarios.size;
  }
}
