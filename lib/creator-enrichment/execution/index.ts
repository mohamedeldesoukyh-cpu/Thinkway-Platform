export {
  getOptimizationPolicy,
  resetOptimizationPolicyForTests,
  setOptimizationPolicyForTests,
  isWithinDays,
} from "./optimization-policy";
export type { OptimizationPolicyConfig, StageCostEstimates, StageDurationEstimatesMs } from "./optimization-policy";

export type {
  BuildExecutionPlanInput,
  ExecutionPlan,
  ExecutionPlanTotals,
  ExecutionStageAction,
  ExecutionStageId,
  ExecutionStagePlan,
} from "./execution-plan-types";

export {
  buildExecutionPlan,
  attachActualDuration,
  planExecution,
  PIPELINE_ENFORCEMENT_ENABLED,
  PIPELINE_ENFORCEMENT_DISABLED_REASON,
} from "./execution-planner";

export { planStages, planStagesForShortCircuit } from "./stage-planner";
export type { StageDecision } from "./stage-planner";

export { computePlanTotals, enrichStageDecisions } from "./plan-estimation";

export {
  buildExecutionTrace,
  logExecutionTrace,
  logExecutionPlanComplete,
} from "./execution-trace";
export type { ExecutionTrace } from "./execution-trace";

export {
  recordExecutionPlanMetrics,
  recordExecutionActualDuration,
  recordExecutionOperationalMetrics,
  getExecutionOperationalMetricsSnapshot,
  resetExecutionOperationalMetricsForTests,
} from "./operational-metrics";
export type { ExecutionOperationalMetricsSnapshot } from "./operational-metrics";
