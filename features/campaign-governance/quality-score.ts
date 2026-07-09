import type {
  GovernanceReport,
  QualityScoreDimensions,
  QualityScoreResult,
} from "./governance-types";

export const QUALITY_SCORE_WEIGHTS: Record<keyof QualityScoreDimensions, number> = {
  businessLogic: 0.15,
  consistency: 0.15,
  compliance: 0.12,
  presentation: 0.13,
  evidence: 0.1,
  recommendationQuality: 0.12,
  executiveReadiness: 0.13,
  dataConfidence: 0.1,
};

export const QUALITY_SCORE_THRESHOLD = 90;
export const MAX_WARNINGS_ALLOWED = 5;

function reportToDimensionScore(report: GovernanceReport): number {
  const { pass, warning, fail, total } = report.summary;
  if (total === 0) return 0;
  const raw = ((pass + warning * 0.5) / total) * 100;
  const penalty = fail * 8;
  return Math.max(0, Math.min(100, Math.round(raw - penalty)));
}

function countWarnings(reports: GovernanceReport[]): number {
  return reports.reduce((sum, r) => sum + r.summary.warning, 0);
}

function countFails(reports: GovernanceReport[]): number {
  return reports.reduce((sum, r) => sum + r.summary.fail, 0);
}

export type ComputeQualityScoreInput = {
  qaReport: GovernanceReport;
  complianceReport: GovernanceReport;
  presentationReport: GovernanceReport;
  factsConfidenceAvg?: number;
};

/**
 * Thinkway Quality Score — weighted dimensions (0–100 each) with approval rules.
 */
export function computeQualityScore(input: ComputeQualityScoreInput): QualityScoreResult {
  const { qaReport, complianceReport, presentationReport, factsConfidenceAvg = 0.75 } = input;

  const businessLogic = reportToDimensionScore(qaReport);
  const consistency = Math.round(
    (reportToDimensionScore(qaReport) +
      qaReport.checks.filter((c) => c.id.startsWith("qa_") && c.status === "PASS").length * 2) /
      2
  );
  const compliance = reportToDimensionScore(complianceReport);
  const presentation = reportToDimensionScore(presentationReport);

  const evidenceChecks = presentationReport.checks.filter((c) => c.id.includes("evidence"));
  const evidence =
    evidenceChecks.length > 0
      ? evidenceChecks[0]!.status === "PASS"
        ? 85
        : evidenceChecks[0]!.status === "WARNING"
          ? 65
          : 40
      : 70;

  const rationaleChecks = presentationReport.checks.filter((c) => c.id.includes("rationale"));
  const recommendationQuality =
    rationaleChecks.length > 0
      ? rationaleChecks[0]!.status === "PASS"
        ? 88
        : rationaleChecks[0]!.status === "WARNING"
          ? 68
          : 45
      : 72;

  const execChecks = presentationReport.checks.filter((c) => c.id.startsWith("pres_exec"));
  const execPass = execChecks.filter((c) => c.status === "PASS").length;
  const executiveReadiness =
    execChecks.length > 0 ? Math.round((execPass / execChecks.length) * 100) : 75;

  const dataConfidence = Math.round(factsConfidenceAvg * 100);

  const dimensions: QualityScoreDimensions = {
    businessLogic: Math.min(100, businessLogic),
    consistency: Math.min(100, consistency),
    compliance: Math.min(100, compliance),
    presentation: Math.min(100, presentation),
    evidence: Math.min(100, evidence),
    recommendationQuality: Math.min(100, recommendationQuality),
    executiveReadiness: Math.min(100, executiveReadiness),
    dataConfidence: Math.min(100, dataConfidence),
  };

  let overall = 0;
  for (const [key, weight] of Object.entries(QUALITY_SCORE_WEIGHTS) as Array<
    [keyof QualityScoreDimensions, number]
  >) {
    overall += dimensions[key] * weight;
  }
  overall = Math.round(overall);

  const reports = [qaReport, complianceReport, presentationReport];
  const warningCount = countWarnings(reports);
  const failCount = countFails(reports);
  const rejectionReasons: string[] = [];

  if (failCount > 0) {
    rejectionReasons.push(`${failCount} governance check(s) FAILED`);
  }
  if (overall < QUALITY_SCORE_THRESHOLD) {
    rejectionReasons.push(`Quality score ${overall} below threshold ${QUALITY_SCORE_THRESHOLD}`);
  }
  if (warningCount > MAX_WARNINGS_ALLOWED) {
    rejectionReasons.push(`${warningCount} warnings exceed limit of ${MAX_WARNINGS_ALLOWED}`);
  }

  const approved =
    failCount === 0 && overall >= QUALITY_SCORE_THRESHOLD && warningCount <= MAX_WARNINGS_ALLOWED;

  return {
    overall,
    dimensions,
    weights: QUALITY_SCORE_WEIGHTS,
    approved,
    rejectionReasons,
  };
}
