/**
 * CDI Phase 1 — Campaign Decision Engine public API.
 */

export type {
  ApprovalSummary,
  BudgetChangeDelta,
  CampaignDecisionContext,
  CampaignScenario,
  ClientCreatorEvaluation,
  CreatorAction,
  CreatorChangeDelta,
  DecisionCard,
  DecisionEngineInput,
  DecisionEngineResult,
  KpiDelta,
  KpiMetricKey,
  KpiSnapshot,
  ObjectiveChangeDelta,
  PlatformChangeDelta,
  RecommendationPriority,
  ScenarioChanges,
  ScenarioComparison,
  ScenarioComparisonRow,
  SimulationBudget,
  SimulationCreator,
  SimulationResult,
  SimulationRisk,
  SimulationTimeline,
  StructuredRecommendation,
  ThinkwayScoreBreakdown,
  TimelineChangeDelta,
} from "./decision-types";

export {
  BUDGET_SIMULATION_PRESETS,
  THINKWAY_SCORE_WEIGHTS,
} from "./decision-types";

export {
  assertCampaignObjectImmutable,
  deepFreeze,
  extractCampaignDecisionContext,
  snapshotCampaignObject,
} from "./campaign-context";

export {
  applyBudgetDelta,
  budgetDecisionReason,
  generateBudgetPresetChanges,
  simulateBudgetChange,
} from "./budget-simulator";

export {
  applyCreatorChanges,
  buildClientCreatorScenarioChanges,
  evaluateClientCreators,
  simulateCreatorChanges,
} from "./creator-simulator";

export {
  buildKpiDeltas,
  formatKpiImpact,
  simulateKpis,
} from "./kpi-simulator";

export type { KpiSimulationInput } from "./kpi-simulator";

export {
  compareThinkwayScores,
  computeThinkwayScore,
} from "./decision-score";

export {
  aggregateRecommendations,
  buildDecisionCards,
  generateRecommendations,
  validateRecommendationStructure,
} from "./recommendation-engine";

export {
  buildStandardScenarios,
  compareScenarios,
  createOriginalScenario,
  createScenario,
  resetScenarioCounter,
  ScenarioStore,
  simulateScenario,
} from "./scenario-engine";

export { buildApprovalSummary } from "./approval-summary";

export {
  DecisionEngine,
  runDecisionEngine,
} from "./decision-engine";

export {
  buildAllFixtureCampaignObjects,
  buildFixtureCampaignObject,
  CAMPAIGN_FIXTURES,
} from "./fixtures/campaign-fixtures";

export type {
  CampaignFixtureDefinition,
  CampaignFixtureId,
} from "./fixtures/campaign-fixtures";
