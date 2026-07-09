import type {
  DirectorApprovalReport,
  GovernanceReport,
  QualityScoreResult,
} from "./governance-types";

export type DirectorFinalApprovalInput = {
  qaReport: GovernanceReport;
  complianceReport: GovernanceReport;
  presentationReport: GovernanceReport;
  qualityScore: QualityScoreResult;
};

function gatePassed(report: GovernanceReport): boolean {
  return report.summary.fail === 0;
}

/**
 * Director Final Approval Gate — cannot approve until all prerequisites pass.
 */
export function evaluateDirectorFinalApproval(
  input: DirectorFinalApprovalInput
): DirectorApprovalReport {
  const { qaReport, complianceReport, presentationReport, qualityScore } = input;

  const qaPassed = gatePassed(qaReport);
  const compliancePassed = gatePassed(complianceReport);
  const presentationPassed = gatePassed(presentationReport);
  const qualityScorePassed = qualityScore.approved;

  const warningCount =
    qaReport.summary.warning +
    complianceReport.summary.warning +
    presentationReport.summary.warning;

  const failCount =
    qaReport.summary.fail + complianceReport.summary.fail + presentationReport.summary.fail;

  const blockers: string[] = [];

  if (!qaPassed) blockers.push("Campaign QA Manager gate failed");
  if (!compliancePassed) blockers.push("Compliance gate failed");
  if (!presentationPassed) blockers.push("Presentation validator failed");
  if (!qualityScorePassed) blockers.push(...qualityScore.rejectionReasons);

  const approved =
    qaPassed &&
    compliancePassed &&
    presentationPassed &&
    qualityScorePassed &&
    qualityScore.overall >= 90 &&
    warningCount <= 5 &&
    failCount === 0;

  return {
    reportId: `director-approval-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    decision: {
      approved,
      blockers,
      qualityScore: qualityScore.overall,
      warningCount,
      failCount,
      requiresRevision: !approved,
      decidedAt: new Date().toISOString(),
    },
    prerequisites: {
      qaPassed,
      compliancePassed,
      presentationPassed,
      qualityScorePassed,
    },
  };
}
