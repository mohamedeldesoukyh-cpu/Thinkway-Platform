/**
 * Studio Strategy Engine — Planning Context foundation (Release 2.3 Sprint 1).
 *
 * INTERNAL RUNTIME ORCHESTRATION LAYER — NOT A BUSINESS OBJECT.
 * Permanent governance: `.cursor/rules/thinkway-strategy-engine-governance.mdc`
 * Violation requires Architecture Reopen.
 *
 * Planning Context (product alias: Planning Session) may only orchestrate
 * capabilities, hold runtime state, coordinate entry points, project views,
 * and apply validated changes to canonical Platform objects.
 *
 * It must never be a DB table, CRM object, Studio document, saved entity,
 * owner of business state, or duplicator of business artifacts.
 */

export type {
  PlanningContext,
  PlanningSession,
  PlanningStatus,
  PlanningDerivedView,
} from "./types/planning-context";

export type {
  PlanningEntryPoint,
  PlanningEntryInput,
} from "./types/planning-entry";
export {
  PLANNING_ENTRY_POINTS,
  hydrationSourceToEntryPoint,
} from "./types/planning-entry";

export type {
  PlanningCapabilityId,
  PlanningCapabilityDefinition,
  PlanningCapabilityPatch,
  PlanningSessionSlice,
} from "./types/planning-capability";

export {
  listPlanningCapabilities,
  getPlanningCapability,
  assertCapabilityMayWrite,
  assertCapabilityMayRead,
  assertCapabilityIndependence,
} from "./registry/capability-registry";
export { PLANNING_CAPABILITIES } from "./registry/capabilities";

export {
  createPlanningContextFromCampaignObject,
  projectPlanningSessionFromCampaignObject,
} from "./session/project-from-campaign-object";
export {
  createEmptyPlanningContext,
  createEmptyPlanningSession,
} from "./session/create-planning-session";
export { derivePlanningView } from "./session/derive-planning-view";
export { applyPlanningCapabilityPatch } from "./session/apply-capability-patch";
export {
  resolvePlanningEntry,
  loadPlanningSessionFromCampaignObject,
  type ResolvePlanningEntryResult,
} from "./entry/resolve-planning-entry";
