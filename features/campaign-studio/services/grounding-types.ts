export type GroundingSource =
  | "AI"
  | "Historical"
  | "Industry"
  | "Client"
  | "Creator";

export type GroundedElement = {
  source: GroundingSource;
  confidence: number;
  reason: string;
  evidence?: string;
};

export type GroundedStrategyField = {
  label: string;
  value: string;
  grounding: GroundedElement;
};

export type GroundedBudgetAllocation = {
  category: string;
  percent: number;
  amount?: number;
  reason: string;
  source: GroundingSource;
  confidence: number;
};

export type GroundedKpi = {
  metric: string;
  prediction: string;
  confidence: number;
  reason: string;
  calculationSource: string;
  platform?: string;
  benchmark?: string;
};

export type VendorRankingFactor = {
  factor: string;
  score: number;
  reason: string;
};

export type GroundedVendor = {
  rank: number;
  displayName: string;
  handle: string;
  platform: string;
  whySelected: string;
  factors: VendorRankingFactor[];
  grounding: GroundedElement;
};

export type IndustryBenchmarkComparison = {
  metric: string;
  expected: string;
  industry: string;
  variance: string;
  source: GroundingSource;
};

export type SuccessProbabilityData = {
  score: number;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  improvements: string[];
  grounding: GroundedElement;
  objectiveAssessments?: Array<{
    objective: string;
    confidence: number;
    supportingEvidence: string;
    risks: string[];
    recommendations: string[];
  }>;
};

export type OpportunityItem = {
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  source: GroundingSource;
};

export type ExecutiveSummaryData = {
  summary: string;
  keyDecisions: string[];
  recommendedActions: string[];
  immediateNextSteps: string[];
  expectedBusinessOutcome: string;
  grounding: GroundedElement;
};

export const SOURCE_LABELS: Record<GroundingSource, string> = {
  AI: "AI Reasoning",
  Historical: "Historical Campaigns",
  Industry: "Industry Intelligence",
  Client: "Client Brief",
  Creator: "Creator Intelligence",
};

export const SOURCE_COLORS: Record<GroundingSource, string> = {
  AI: "border-violet-300/50 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  Historical: "border-indigo-300/50 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  Industry: "border-[#1D9E75]/40 bg-[#1D9E75]/10 text-[#1D9E75]",
  Client: "border-amber-300/50 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  Creator: "border-cyan-300/50 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
};
