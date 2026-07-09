/**
 * CDI Phase 1 — Decision Engine types.
 * Scenarios store deltas only; CampaignObject remains immutable SSOT.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorDNADocument } from "@/features/creator-dna/types";

/** Percentage change applied to total budget (negative = cut, positive = increase). */
export type BudgetChangeDelta = {
  percentChange: number;
  label?: string;
};

export type CreatorAction =
  | "remove"
  | "replace"
  | "add"
  | "increase_posts"
  | "decrease_posts"
  | "switch_platform";

export type CreatorChangeDelta = {
  action: CreatorAction;
  creatorId: string;
  replacementCreatorId?: string;
  postCountDelta?: number;
  targetPlatform?: string;
  source?: "thinkway" | "client";
};

export type TimelineChangeDelta = {
  durationWeeksDelta?: number;
  goLiveWeekDelta?: number;
  label?: string;
};

export type ObjectiveChangeDelta = {
  objective?: string;
  campaignType?: string;
  label?: string;
};

export type PlatformChangeDelta = {
  addPlatforms?: string[];
  removePlatforms?: string[];
  primaryPlatform?: string;
};

export type ScenarioChanges = {
  budgetChange?: BudgetChangeDelta;
  creatorChanges?: CreatorChangeDelta[];
  timelineChanges?: TimelineChangeDelta;
  objectiveChanges?: ObjectiveChangeDelta;
  platformChanges?: PlatformChangeDelta;
};

export type KpiMetricKey =
  | "reach"
  | "engagement"
  | "engagementRate"
  | "impressions"
  | "awareness"
  | "cpm"
  | "cpe"
  | "roas"
  | "conversions"
  | "creatorCount"
  | "postCount";

export type KpiSnapshot = {
  reach: number;
  engagement: number;
  engagementRate: number;
  impressions: number;
  awareness: number;
  cpm: number;
  cpe: number;
  roas: number;
  conversions: number;
  creatorCount: number;
  postCount: number;
};

export type KpiDelta = {
  metric: KpiMetricKey;
  before: number;
  after: number;
  percentChange: number;
};

export type SimulationBudget = {
  currency: string;
  total: number;
  creatorFees: number;
  production: number;
  contingency: number;
  percentChange?: number;
};

export type SimulationCreator = {
  id: string;
  handle?: string;
  displayName?: string;
  platform: string;
  followers: number;
  engagementRate: number;
  postCount: number;
  fitScore: number;
  source: "thinkway" | "client";
  cpm: number;
};

export type SimulationTimeline = {
  durationWeeks: number;
  goLiveWeek: number;
};

export type SimulationRisk = {
  level: "low" | "medium" | "high";
  score: number;
  highRiskCount: number;
  factors: string[];
};

export type SimulationResult = {
  budget: SimulationBudget;
  kpis: KpiSnapshot;
  kpiDeltas: KpiDelta[];
  creators: SimulationCreator[];
  timeline: SimulationTimeline;
  risk: SimulationRisk;
  successProbability: number;
};

export type ThinkwayScoreBreakdown = {
  budget: number;
  creatorFit: number;
  audience: number;
  risk: number;
  timeline: number;
  kpis: number;
  total: number;
};

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export type StructuredRecommendation = {
  id: string;
  title: string;
  reason: string;
  confidence: number;
  impact: {
    summary: string;
    kpiDeltas?: KpiDelta[];
    scoreDelta?: number;
  };
  pros: string[];
  cons: string[];
  alternative: {
    title: string;
    description: string;
    tradeoffs: string[];
  };
  priority: RecommendationPriority;
  category: "budget" | "creator" | "timeline" | "objective" | "platform" | "risk" | "kpi";
};

export type DecisionCard = {
  id: string;
  decision: string;
  current: Record<string, string | number>;
  suggested: Record<string, string | number>;
  impact: {
    reach?: number;
    engagement?: number;
    awareness?: number;
    cpm?: number;
    conversions?: number;
  };
  confidence: number;
  reason: string;
};

export type ClientCreatorEvaluation = {
  creatorId: string;
  clientCreator: SimulationCreator;
  thinkwayAlternative?: SimulationCreator;
  fitScore: number;
  thinkwayFitScore: number;
  audienceDiff: number;
  engagementRateDiff: number;
  cpmDiff: number;
  riskLevel: "low" | "medium" | "high";
  replaceRecommended: boolean;
  reason: string;
  dnaAvailable: boolean;
};

export type CampaignScenario = {
  id: string;
  name: string;
  parentCampaignObjectId: string;
  changes: ScenarioChanges;
  simulationResult: SimulationResult;
  thinkwayScore: ThinkwayScoreBreakdown;
  recommendations: StructuredRecommendation[];
  decisionCards: DecisionCard[];
  createdAt: string;
};

export type ScenarioComparisonRow = {
  scenarioId: string;
  scenarioName: string;
  budget: number;
  reach: number;
  engagement: number;
  conversions: number;
  cpm: number;
  creatorCount: number;
  postCount: number;
  riskScore: number;
  timelineWeeks: number;
  thinkwayScore: number;
  successProbability: number;
  isWinner: boolean;
};

export type ScenarioComparison = {
  baselineScenarioId: string;
  rows: ScenarioComparisonRow[];
  winnerScenarioId: string;
};

export type ApprovalSummary = {
  campaignHealth: "healthy" | "at_risk" | "critical";
  warningsCount: number;
  recommendationsCount: number;
  highRisksCount: number;
  clientConstraintsSatisfied: boolean;
  readyForApproval: boolean;
  details: string[];
};

export type CampaignDecisionContext = {
  campaignObjectId: string;
  brand?: string;
  objective?: string;
  market?: string;
  currency: string;
  budget: SimulationBudget;
  kpis: KpiSnapshot;
  creators: SimulationCreator[];
  timeline: SimulationTimeline;
  risk: SimulationRisk;
  successProbability: number;
  platforms: string[];
  industry?: string;
};

export type DecisionEngineInput = {
  campaignObject: CampaignObject;
  /** Optional DNA documents keyed by influencer id — read-only hydration. */
  creatorDna?: Map<string, CreatorDNADocument>;
  /** Pre-defined scenario deltas; Original is always generated. */
  scenarioDeltas?: Array<{ name: string; changes: ScenarioChanges }>;
  /** Client-preferred creator ids for evaluation. */
  clientCreatorIds?: string[];
};

export type DecisionEngineResult = {
  campaignObjectId: string;
  baseline: CampaignDecisionContext;
  scenarios: CampaignScenario[];
  comparison: ScenarioComparison;
  clientCreatorEvaluations: ClientCreatorEvaluation[];
  approvalSummary: ApprovalSummary;
  recommendations: StructuredRecommendation[];
};

/** Standard budget simulation presets. */
export const BUDGET_SIMULATION_PRESETS = [
  { percentChange: -30, label: "Budget -30%" },
  { percentChange: -20, label: "Budget -20%" },
  { percentChange: -10, label: "Budget -10%" },
  { percentChange: -5, label: "Budget -5%" },
  { percentChange: 10, label: "Budget +10%" },
  { percentChange: 25, label: "Budget +25%" },
  { percentChange: 50, label: "Budget +50%" },
] as const;

export const THINKWAY_SCORE_WEIGHTS = {
  budget: 20,
  creatorFit: 25,
  audience: 20,
  risk: 15,
  timeline: 10,
  kpis: 10,
} as const;
