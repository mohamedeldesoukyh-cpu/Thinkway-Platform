/**
 * @deprecated Prefer `./planning-context`.
 *
 * "Planning Session" is the product name for the internal Planning Context
 * orchestration handle. It is NOT a second business object and has no
 * persistence of its own.
 */

export type {
  PlanningContext,
  PlanningSession,
  PlanningStatus,
  PlanningDerivedView,
} from "./planning-context";
