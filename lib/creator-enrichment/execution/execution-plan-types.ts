import type { CreatorEnrichmentDecisionResult } from "@/lib/creator-enrichment/decision/decision-result";
import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";

export type ExecutionStageId =
  | "metrics"
  | "ipl"
  | "creatorDna"
  | "avatar"
  | "audience"
  | "platformMetadata"
  | "aiAnalysis";

export type ExecutionStageAction = "run" | "reuse" | "skip";

export type ExecutionStagePlan = Readonly<{
  stage: ExecutionStageId;
  action: ExecutionStageAction;
  reason: string;
  estimatedCost: Readonly<{
    apifyCredits: number;
    aiProcessingUnits: number;
    externalApiCalls: number;
  }>;
  estimatedDurationMs: number;
}>;

export type ExecutionPlanTotals = Readonly<{
  estimatedApifyCredits: number;
  estimatedAiProcessingUnits: number;
  estimatedExternalApiCalls: number;
  estimatedDurationMs: number;
  estimatedApifyCreditsIfAllRun: number;
  estimatedSavingsApifyCredits: number;
  estimatedSavingsAiUnits: number;
  estimatedSavingsDurationMs: number;
  optimizationPercentage: number;
  stagesRun: number;
  stagesReuse: number;
  stagesSkip: number;
}>;

export type ExecutionPlan = Readonly<{
  planId: string;
  traceId: string;
  decisionId: string;
  requestId: string;
  winningRule: string | null;
  decision: CreatorEnrichmentDecisionResult["decision"];
  decisionReason: string;
  snapshotVersion: string;
  /** False until pipeline supports safe partial execution. */
  enforcementEnabled: boolean;
  pipelineMode: "full_legacy" | "partial_ready";
  stages: readonly ExecutionStagePlan[];
  totals: ExecutionPlanTotals;
  optimizationSummary: string;
  reusedIntelligence: readonly string[];
  skippedStages: readonly ExecutionStageId[];
  actualDurationMs: number | null;
  createdAt: string;
}>;

export type BuildExecutionPlanInput = Readonly<{
  requestId: string;
  force: boolean;
  snapshot: CreatorIntelligenceSnapshot;
  decision: CreatorEnrichmentDecisionResult;
}>;
