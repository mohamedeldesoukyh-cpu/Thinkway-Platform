/**
 * Campaign Deliverables Engine.
 *
 * Every client-facing deliverable is a generated view over the Campaign Object
 * (the Single Source of Truth). The registry tracks generation state and a
 * dependency graph; deterministic generators produce the views; staleness
 * propagates precisely to the deliverables affected by a change.
 */

export * from "./deliverable-types";
export {
  DELIVERABLE_CATALOG,
  INPUT_KEY_LABELS,
  getDeliverableDefinition,
  type DeliverableDefinition,
  type DeliverableGenerator,
} from "./deliverable-catalog";
export { computeSourceFingerprint } from "./deliverable-fingerprint";
export { resolveSlate, resolveInputValue, overallScore, type SlateCreator } from "./deliverable-inputs";
export {
  getDeliverableState,
  getDeliverable,
  listDeliverables,
  generateDeliverable,
  markStaleDeliverables,
  staleDeliverableKinds,
  type DeliverableView,
  type GenerateDeliverableResult,
} from "./deliverable-registry";
export { generateMediaPlan, type MediaPlanData } from "./generators/media-plan";
export { generateFullStrategy } from "./generators/strategy";
