import type {
  CampaignScenario,
  ClientCreatorEvaluation,
  ScenarioChanges,
  StructuredRecommendation,
  ThinkwayScoreBreakdown,
} from "@/features/campaign-decision-engine";

export type ScenarioPresetId =
  | "budget_cut"
  | "client_selection"
  | "alternative_creators"
  | "luxury_positioning"
  | "sales_objective"
  | "high_roi";

export type ScenarioPreset = {
  id: ScenarioPresetId;
  label: string;
  changes: ScenarioChanges;
};

export type DecisionTimelineEntry = {
  id: string;
  scenarioId: string;
  scenarioName: string;
  action: "created" | "modified" | "simulated" | "promoted";
  createdBy: string;
  createdAt: string;
  changesSummary: string;
  reason?: string;
  recommendation?: string;
};

export type ClientCreatorRecommendation =
  | "keep_thinkway"
  | "replace"
  | "hybrid"
  | "need_review";

export type ClientCreatorAssessment = ClientCreatorEvaluation & {
  recommendation: ClientCreatorRecommendation;
  audienceMatch: number;
  brandFit: number;
  overlap: number;
};

export type ScoreMetricKey = keyof Omit<ThinkwayScoreBreakdown, "total">;

export type ScoreMetricExplanation = {
  key: ScoreMetricKey;
  label: string;
  score: number;
  maxScore: number;
  why: string;
  evidence: string;
  confidence: number;
  improvements: string[];
};

export type MetricComparison = {
  label: string;
  value: number;
  baseline: number;
  percentChange: number;
  format?: "currency" | "number" | "percent" | "score";
  currency?: string;
};

export type WorkspaceScenarioRecord = CampaignScenario & {
  reason?: string;
  createdBy?: string;
  isOriginal?: boolean;
};

export type PromoteScenarioResult = {
  campaignObjectId: string;
  version: number;
  versionId: string;
  promotedScenarioName: string;
};

export type DecisionWorkspaceState = {
  baselineScenario: WorkspaceScenarioRecord;
  scenarios: WorkspaceScenarioRecord[];
  selectedScenarioId: string;
  comparisonScenarioIds: string[];
  timeline: DecisionTimelineEntry[];
  topRecommendation: StructuredRecommendation | null;
};
