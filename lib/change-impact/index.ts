/**
 * Enterprise Change Impact Engine
 *
 * Intelligence layer above Document Lifecycle:
 * interpret business changes → affected objects → impacted documents →
 * severity → business explanation → recommended actions →
 * Decision Center · Notifications · Timeline · AI-ready recommendations.
 *
 * Document Lifecycle remains responsible only for document state transitions.
 *
 * Docs: docs/architecture/ENTERPRISE_CHANGE_IMPACT_ENGINE.md
 */

export { assessBusinessChangeImpact } from "@/lib/change-impact/assess";
export {
  applyBusinessChangeImpact,
  type ApplyChangeImpactResult,
} from "@/lib/change-impact/apply";
export { loadOpenChangeImpactSignals } from "@/lib/change-impact/load-open-assessments";
export {
  changeImpactSignalsToDecisionBlockers,
  mapChangeImpactToDecisionSeverity,
  assessmentRowToDecisionSignal,
} from "@/lib/change-impact/feeds/decision-center";
export {
  listPendingChangeImpactNotifications,
  markChangeImpactNotificationDelivered,
} from "@/lib/change-impact/feeds/notifications";
export {
  projectChangeImpactAiRecommendation,
  formatChangeImpactAiBrief,
} from "@/lib/change-impact/feeds/ai-recommendations";
export {
  CHANGE_IMPACT_SEVERITY_LABEL,
  formatChangeImpactSeverity,
  type ChangeImpactSeverityLabel,
} from "@/lib/change-impact/severity";
export type * from "@/lib/change-impact/types";

/** Canonical entry point alias — use this in all future modules. */
export { applyBusinessChangeImpact as assessAndApplyBusinessChange } from "@/lib/change-impact/apply";
