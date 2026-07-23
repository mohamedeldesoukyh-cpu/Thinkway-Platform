import type {
  ExecutionPlanTotals,
  ExecutionStagePlan,
} from "./execution-plan-types";
import type { StageDecision } from "./stage-planner";
import { getOptimizationPolicy } from "./optimization-policy";

const STAGE_COST_KEY = {
  metrics: "metricsRun",
  ipl: "iplRun",
  creatorDna: "dnaRun",
  avatar: "avatarRun",
  audience: "audienceRun",
  platformMetadata: "platformMetadataRun",
  aiAnalysis: "aiAnalysisRun",
} as const;

const STAGE_DURATION_KEY = {
  metrics: "metrics",
  ipl: "ipl",
  creatorDna: "creatorDna",
  avatar: "avatar",
  audience: "audience",
  platformMetadata: "platformMetadata",
  aiAnalysis: "aiAnalysis",
} as const;

function zeroCost() {
  return { apifyCredits: 0, aiProcessingUnits: 0, externalApiCalls: 0 };
}

export function enrichStageDecisions(decisions: StageDecision[]): ExecutionStagePlan[] {
  const policy = getOptimizationPolicy();

  return decisions.map((decision) => {
    const costKey = STAGE_COST_KEY[decision.stage];
    const durationKey = STAGE_DURATION_KEY[decision.stage];
    const runCost = policy.stageCosts[costKey];
    const runDuration = policy.stageDurationsMs[durationKey];

    if (decision.action === "run") {
      return Object.freeze({
        stage: decision.stage,
        action: decision.action,
        reason: decision.reason,
        estimatedCost: Object.freeze({ ...runCost }),
        estimatedDurationMs: runDuration,
      });
    }

    return Object.freeze({
      stage: decision.stage,
      action: decision.action,
      reason: decision.reason,
      estimatedCost: Object.freeze(zeroCost()),
      estimatedDurationMs: 0,
    });
  });
}

export function computePlanTotals(stages: readonly ExecutionStagePlan[]): ExecutionPlanTotals {
  let estimatedApifyCredits = 0;
  let estimatedAiProcessingUnits = 0;
  let estimatedExternalApiCalls = 0;
  let estimatedDurationMs = 0;
  let estimatedApifyCreditsIfAllRun = 0;
  let stagesRun = 0;
  let stagesReuse = 0;
  let stagesSkip = 0;

  for (const stage of stages) {
    estimatedApifyCredits += stage.estimatedCost.apifyCredits;
    estimatedAiProcessingUnits += stage.estimatedCost.aiProcessingUnits;
    estimatedExternalApiCalls += stage.estimatedCost.externalApiCalls;
    estimatedDurationMs += stage.estimatedDurationMs;

    const policy = getOptimizationPolicy();
    const costKey = STAGE_COST_KEY[stage.stage];
    estimatedApifyCreditsIfAllRun += policy.stageCosts[costKey].apifyCredits;

    if (stage.action === "run") stagesRun += 1;
    if (stage.action === "reuse") stagesReuse += 1;
    if (stage.action === "skip") stagesSkip += 1;
  }

  const estimatedSavingsApifyCredits = Math.max(
    0,
    estimatedApifyCreditsIfAllRun - estimatedApifyCredits
  );
  const allRunAi = stages.reduce((sum, stage) => {
    const costKey = STAGE_COST_KEY[stage.stage];
    return sum + getOptimizationPolicy().stageCosts[costKey].aiProcessingUnits;
  }, 0);
  const estimatedSavingsAiUnits = Math.max(0, allRunAi - estimatedAiProcessingUnits);
  const allRunDuration = stages.reduce((sum, stage) => {
    const durationKey = STAGE_DURATION_KEY[stage.stage];
    return sum + getOptimizationPolicy().stageDurationsMs[durationKey];
  }, 0);
  const estimatedSavingsDurationMs = Math.max(0, allRunDuration - estimatedDurationMs);
  const optimizationPercentage =
    allRunDuration === 0
      ? 0
      : Math.round((estimatedSavingsDurationMs / allRunDuration) * 100);

  return Object.freeze({
    estimatedApifyCredits,
    estimatedAiProcessingUnits,
    estimatedExternalApiCalls,
    estimatedDurationMs,
    estimatedApifyCreditsIfAllRun,
    estimatedSavingsApifyCredits,
    estimatedSavingsAiUnits,
    estimatedSavingsDurationMs,
    optimizationPercentage,
    stagesRun,
    stagesReuse,
    stagesSkip,
  });
}
