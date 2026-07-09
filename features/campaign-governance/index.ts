export type {
  CampaignGovernanceMeta,
  DirectorApprovalDecision,
  DirectorApprovalReport,
  GovernanceCheck,
  GovernanceCheckStatus,
  GovernancePipelineResult,
  GovernanceReport,
  GovernanceReportSummary,
  GovernanceValidationInput,
  QualityScoreDimensions,
  QualityScoreResult,
} from "./governance-types";

export { runCampaignQaManager } from "./campaign-qa-manager";
export { runComplianceGate } from "./compliance-gate";
export { runPresentationValidator } from "./presentation-validator";
export {
  computeQualityScore,
  QUALITY_SCORE_THRESHOLD,
  QUALITY_SCORE_WEIGHTS,
  MAX_WARNINGS_ALLOWED,
} from "./quality-score";
export { evaluateDirectorFinalApproval } from "./director-final-approval";
export {
  runGovernancePipeline,
  buildCampaignGovernanceMeta,
  averageFactsConfidence,
} from "./governance-pipeline";

export {
  GENERIC_PHRASE_BLOCKLIST,
  computeTextSimilarity,
  detectGenericPhrases,
  detectCrossSectionCopyPaste,
  detectPriorCampaignCopyPaste,
  simpleTextHash,
} from "./generic-language-detector";

export type { GenericLanguageFinding, CopyPasteFinding } from "./generic-language-detector";

export { GOVERNANCE_BRIEF_FIXTURES } from "./fixtures/governance-brief-fixtures";
