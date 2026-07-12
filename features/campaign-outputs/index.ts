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
  INPUT_KEY_LABELS,
  getOutputDefinition,
  outputsDependingOn,
  type OutputDefinition,
  type OutputGenerator,
} from "./output-catalog";
export { computeSourceFingerprint } from "./output-fingerprint";
export { resolveSlate, resolveInputValue, overallScore, type SlateCreator } from "./output-inputs";
export {
  getCampaignOutputState,
  getCampaignOutput,
  listCampaignOutputs,
  generateCampaignOutput,
  markStaleCampaignOutputs,
  staleCampaignOutputKinds,
  type OutputView,
  type GenerateCampaignOutputResult,
} from "./output-registry";
export { renderOutputMarkdown } from "./output-markdown";
export {
  generateMediaPlan,
  MEDIA_PLAN_GENERATOR_VERSION,
  type MediaPlanData,
} from "./generators/media-plan";
export { generateFullStrategy, STRATEGY_GENERATOR_VERSION } from "./generators/strategy";
export {
  resolveOutputKind,
  runGenerateOutput,
  runExportOutput,
  type OutputCopilotResult,
} from "./copilot/output-copilot";
