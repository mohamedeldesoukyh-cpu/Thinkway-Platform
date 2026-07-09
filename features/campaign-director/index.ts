export type {
  ApprovalGate,
  CampaignBriefInput,
  CampaignStrategyDocument,
  CrossReviewFinding,
  DirectorApprovedSection,
  DirectorChallenge,
  DirectorConflictType,
  DirectorPipelineResult,
  DirectorPipelineState,
  DirectorReviewReport,
  DirectorReviewReportEntry,
  DirectorSpecialistId,
  ReviewConversationAction,
  ReviewConversationTurn,
  SpecialistOutput,
  SpecialistRevision,
} from "./types";

export {
  runCampaignDirectorPipeline,
  initializeDirectorPipelineState,
  buildDirectorTaskPrompt,
  getStrategyFromWorkflowData,
  getCampaignFactsFromWorkflowData,
  finalizeDirectorPipelineFromWorkflow,
  DIRECTOR_PIPELINE_STATE_KEY,
  formatStrategyForSpecialist,
  writeStrategyDocumentFromBrief,
  getSpecialistDomain,
} from "./services/campaign-director";

export { evaluateApprovalGate } from "./services/approval-gate";
export { evaluateDecisionIntelligenceGate } from "./services/decision-intelligence-gate";
export type {
  DecisionIntelligenceCheck,
  DecisionIntelligenceGateResult,
} from "./services/decision-intelligence-gate";
export { detectConflicts, countOpenChallenges } from "./services/conflict-detector";
export { runCrossReview, countOpenCrossReviewFindings } from "./services/cross-review-engine";
export {
  runDirectorChallengeLoop,
  markSpecialistsApproved,
  MAX_REVISION_ROUNDS,
} from "./services/director-challenge-loop";
export {
  applySpecialistRevision,
  runRevisionValidators,
} from "./services/revision-engine";
export {
  dispatchSpecialists,
  mergeTaskOutputsIntoSpecialists,
  resolveSpecialistForTask,
  specialistOutputFromTask,
} from "./services/specialist-dispatch";
export {
  buildDirectorBudgetFromStrategy,
  validateBudgetTotals100,
  briefRequiresOptionalCategories,
  briefForbidsBudgetSplit,
  detectBudgetSplitKeywords,
  defaultCreatorFeesRationale,
  BUDGET_SPLIT_KEYWORD_PATTERNS,
} from "./services/budget-rules";
export {
  buildClientTimelineFromStrategy,
  isInternalTimelinePhase,
  sanitizeToClientTimeline,
  CLIENT_FACING_TIMELINE_PHASES,
  INTERNAL_TIMELINE_PATTERNS,
} from "./services/timeline-rules";

export {
  applyDirectorApprovedSections,
  injectDirectorStrategyIntoWorkflowState,
  enrichWorkflowStateWithDirectorPipeline,
  applyDirectorPipelineToCampaignObject,
} from "./integrations/workflow-integration";

export {
  runDirectorDebateEngine,
  validateOptionMaterialDifference,
  analyzeMaterialDimensions,
  summarizeOptionStrategy,
  MIN_MATERIAL_DIMENSIONS,
  applyWinnerOptionToStrategy,
  applyWinnerOptionToCampaignObject,
  buildDebateMetadata,
  getDirectorCount,
} from "./debate";

export type {
  DebateResult,
  DebateMetadata,
  CampaignOption,
  DirectorReview,
} from "./debate";

export {
  enrichSectionsWithDirectorRationale,
  applyDirectorBudgetRules,
  applyDirectorTimelineRules,
} from "./integrations/section-builder-integration";

export type {
  CampaignFacts,
  CampaignFactsExtractInput,
  CampaignFactsField,
  CampaignFactsSource,
} from "./facts/campaign-facts-types";

export {
  extractCampaignFacts,
  validateCampaignFacts,
  campaignFactsMatchCore,
  formatCampaignFactsForSpecialist,
  listPopulatedFactsFields,
} from "./facts";
