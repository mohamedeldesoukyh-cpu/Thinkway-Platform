import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import { runCampaignQaManager } from "./campaign-qa-manager";
import { runComplianceGate } from "./compliance-gate";
import { evaluateDirectorFinalApproval } from "./director-final-approval";
import type { CampaignGovernanceMeta, GovernancePipelineResult, GovernanceValidationInput } from "./governance-types";
import { runPresentationValidator } from "./presentation-validator";
import { computeQualityScore } from "./quality-score";

export function runGovernancePipeline(input: GovernanceValidationInput): GovernancePipelineResult {
  const qaReport = runCampaignQaManager(input);
  const complianceReport = runComplianceGate(input);
  const presentationReport = runPresentationValidator(input);

  const confidenceValues = Object.values(input.facts.confidence ?? {});
  const factsConfidenceAvg =
    confidenceValues.length > 0
      ? confidenceValues.reduce((s, v) => s + v, 0) / confidenceValues.length
      : 0.75;

  const qualityScore = computeQualityScore({
    qaReport,
    complianceReport,
    presentationReport,
    factsConfidenceAvg,
  });

  const directorApproval = evaluateDirectorFinalApproval({
    qaReport,
    complianceReport,
    presentationReport,
    qualityScore,
  });

  return {
    qaReport,
    complianceReport,
    presentationReport,
    qualityScore,
    directorApproval,
    releaseApproved: directorApproval.decision.approved,
  };
}

export function buildCampaignGovernanceMeta(
  result: GovernancePipelineResult
): CampaignGovernanceMeta {
  return {
    qaReport: result.qaReport,
    complianceReport: result.complianceReport,
    presentationReport: result.presentationReport,
    qualityScore: result.qualityScore,
    directorApprovalReport: result.directorApproval,
    releaseApproved: result.releaseApproved,
    validatedAt: new Date().toISOString(),
  };
}

export function averageFactsConfidence(facts: CampaignFacts): number {
  const values = Object.values(facts.confidence ?? {});
  if (values.length === 0) return 0.75;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
