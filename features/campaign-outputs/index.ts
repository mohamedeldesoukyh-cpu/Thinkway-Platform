/**
 * Campaign Outputs Engine — a platform capability.
 *
 *   Campaign Object (Single Source of Truth)
 *         ├── Campaign Studio        (consumes outputs)
 *         └── Campaign Outputs Engine (generates outputs)
 *
 * Every Campaign Output (Strategy, Media Plan, Proposal, Timeline, KPI Forecast,
 * Risk Plan, …) is a generated *view* over the Campaign Object — never a
 * separate object, never duplicated data. The Output Registry tracks generation
 * state + a dependency graph; Output Generators produce the views; staleness
 * propagates precisely to the outputs affected by a change.
 */

export * from "./output-types";
export {
  OUTPUT_CATALOG,
  OUTPUT_GROUPS,
  INPUT_KEY_LABELS,
  getOutputDefinition,
  outputsDependingOn,
  type OutputDefinition,
  type OutputGenerator,
} from "./output-catalog";
export {
  computeSourceFingerprint,
  computeInputFingerprint,
  computeInputFingerprints,
} from "./output-fingerprint";
export { describeInputsChanged, INPUT_CHANGE_PHRASES } from "./output-stale-reason";
export { resolveSlate, resolveInputValue, overallScore, type SlateCreator } from "./output-inputs";
export {
  getCampaignOutputState,
  getCampaignOutput,
  listCampaignOutputs,
  listCampaignOutputsByGroup,
  generateCampaignOutput,
  markStaleCampaignOutputs,
  staleCampaignOutputKinds,
  describeStaleReason,
  getOutputVersions,
  compareOutputVersions,
  restoreOutputVersion,
  type OutputView,
  type OutputVersionDiff,
  type GenerateCampaignOutputResult,
} from "./output-registry";
export { renderOutputMarkdown } from "./output-markdown";
export {
  generateMediaPlan,
  MEDIA_PLAN_GENERATOR_VERSION,
  type MediaPlanData,
  type MediaPlanWeek,
  type MediaPlanDay,
} from "./generators/media-plan";
export { generateFullStrategy, STRATEGY_GENERATOR_VERSION } from "./generators/strategy";
export { generateKpiForecast, KPI_FORECAST_GENERATOR_VERSION } from "./generators/kpi-forecast";
export { generateRiskPlan, RISK_PLAN_GENERATOR_VERSION } from "./generators/risk-plan";
export {
  generateAmplificationPlan,
  AMPLIFICATION_PLAN_GENERATOR_VERSION,
} from "./generators/amplification-plan";
export {
  generateBudgetAllocation,
  BUDGET_ALLOCATION_GENERATOR_VERSION,
} from "./generators/budget-allocation";
export {
  generateCreatorActivation,
  CREATOR_ACTIVATION_GENERATOR_VERSION,
} from "./generators/creator-activation";
export {
  generateContentCalendar,
  CONTENT_CALENDAR_GENERATOR_VERSION,
} from "./generators/content-calendar";
export {
  generateInternalOperations,
  INTERNAL_OPERATIONS_GENERATOR_VERSION,
} from "./generators/internal-operations";
export {
  generateExecutiveProposal,
  EXECUTIVE_PROPOSAL_GENERATOR_VERSION,
} from "./generators/executive-proposal";
export {
  recommendServices,
  primaryService,
  parseKpiTargets,
  benchmarkFor,
} from "./generators/generator-utils";
export {
  resolveOutputKind,
  runGenerateOutput,
  runExportOutput,
  runOpenOutput,
  runPreviewOutput,
  runExplainStaleness,
  runCompareVersions,
  type OutputCopilotResult,
} from "./copilot/output-copilot";
export * from "./hydration";
export * from "./director";
