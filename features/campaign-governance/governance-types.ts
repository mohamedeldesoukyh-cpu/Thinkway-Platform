/** Release 1.1.7 — Enterprise Governance types (metadata only, not UI). */

export type GovernanceCheckStatus = "PASS" | "WARNING" | "FAIL";

export type GovernanceCheck = {
  id: string;
  name: string;
  status: GovernanceCheckStatus;
  section?: string;
  issue?: string;
  severity?: "low" | "medium" | "high";
  recommendation?: string;
};

export type GovernanceReportSummary = {
  pass: number;
  warning: number;
  fail: number;
  total: number;
};

export type GovernanceReport = {
  reportId: string;
  generatedAt: string;
  checks: GovernanceCheck[];
  summary: GovernanceReportSummary;
};

export type QualityScoreDimensions = {
  businessLogic: number;
  consistency: number;
  compliance: number;
  presentation: number;
  evidence: number;
  recommendationQuality: number;
  executiveReadiness: number;
  dataConfidence: number;
};

export type QualityScoreResult = {
  overall: number;
  dimensions: QualityScoreDimensions;
  weights: Record<keyof QualityScoreDimensions, number>;
  approved: boolean;
  rejectionReasons: string[];
};

export type DirectorApprovalDecision = {
  approved: boolean;
  blockers: string[];
  qualityScore: number;
  warningCount: number;
  failCount: number;
  requiresRevision: boolean;
  decidedAt: string;
};

export type DirectorApprovalReport = {
  reportId: string;
  generatedAt: string;
  decision: DirectorApprovalDecision;
  prerequisites: {
    qaPassed: boolean;
    compliancePassed: boolean;
    presentationPassed: boolean;
    qualityScorePassed: boolean;
  };
};

export type GovernancePipelineResult = {
  qaReport: GovernanceReport;
  complianceReport: GovernanceReport;
  presentationReport: GovernanceReport;
  qualityScore: QualityScoreResult;
  directorApproval: DirectorApprovalReport;
  /** Convenience — true only when director approval grants release to CampaignObject. */
  releaseApproved: boolean;
};

export type CampaignGovernanceMeta = {
  qaReport: GovernanceReport;
  complianceReport: GovernanceReport;
  presentationReport: GovernanceReport;
  qualityScore: QualityScoreResult;
  directorApprovalReport: DirectorApprovalReport;
  releaseApproved: boolean;
  validatedAt: string;
};

export type GovernanceValidationInput = {
  briefText: string;
  facts: import("@/features/campaign-director/facts/campaign-facts-types").CampaignFacts;
  strategy: import("@/features/campaign-director/types/pipeline").CampaignStrategyDocument;
  specialistOutputs: import("@/features/campaign-director/types/pipeline").SpecialistOutput[];
  budget: import("@/features/campaign-intelligence/types/section-schemas").BudgetSectionData;
  timelineWeeks: number;
  /** Optional prior campaign section texts for copy-paste detection. */
  priorCampaignTexts?: string[];
};
