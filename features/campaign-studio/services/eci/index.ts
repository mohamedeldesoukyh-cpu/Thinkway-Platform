export {
  projectStudioEciPlanningSignal,
  buildStudioEciSignalMap,
  studioEciFitScoreRecord,
  lookupStudioEciSignal,
  formatStudioEciReason,
  type StudioEciPlanningSignal,
  type StudioPlanningDecision,
  type StudioEciLayerSummary,
} from "./project-studio-eci-signal";

export {
  toExecutiveCreatorCardView,
  toExecutiveCreatorDetailView,
  deriveStrategyConfidence,
  buildStudioExecutivePlanningSummary,
  formatExecutiveProposalCreatorBlock,
  formatExecutivePresentationChain,
  pickStrategyCompareFinal,
  toCampaignDecisionLabel,
  type ExecutiveCreatorCardView,
  type StrategyConfidence,
  type StudioExecutivePlanningSummary,
} from "./executive-planning-view";

export {
  buildDecisionImpactBundle,
  formatDecisionImpactSummary,
  DECISION_CHANGE_LABELS,
  type DecisionChangeKind,
  type DecisionImpactAssessment,
  type DecisionImpactBundle,
} from "./decision-impact";

export {
  buildRecommendationNarrative,
  assertRecommendationNarrativeComplete,
  INSUFFICIENT_EVIDENCE,
  RECOMMENDATION_NARRATIVE_STEPS,
  type RecommendationNarrative,
  type PlanningAlternatives,
} from "./recommendation-narrative";

import { formatExecutiveProposalCreatorBlock, formatExecutivePresentationChain } from "./executive-planning-view";
import type { StudioEciPlanningSignal } from "./project-studio-eci-signal";

export function formatStudioProposalCreatorNarrative(
  signal: StudioEciPlanningSignal,
  displayName: string
): string {
  return formatExecutiveProposalCreatorBlock(signal, displayName).narrative;
}

export function formatStudioPresentationRecommendation(
  signal: StudioEciPlanningSignal
): string {
  return formatExecutivePresentationChain(signal);
}

export { loadStudioEciPlanningSignals } from "./load-studio-eci-signals";
