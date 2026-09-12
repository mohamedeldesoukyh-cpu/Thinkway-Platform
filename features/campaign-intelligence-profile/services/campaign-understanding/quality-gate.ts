import type {
  CampaignUnderstanding,
  QualityGateAssessment,
  QualityGateStatus,
  StageQualityGateRequirements,
  StageQualityGateResult,
} from "../../types/campaign-understanding";
import { deriveUnderstandingCoverage, issuesForStage, validateCampaignUnderstanding } from "./validation";

function assessment(
  dimension: QualityGateAssessment["dimension"],
  status: QualityGateStatus,
  reason: string,
  subjectIds?: string[]
): QualityGateAssessment {
  return { dimension, status, reason, subjectIds };
}

function aggregateStatus(assessments: QualityGateAssessment[]): QualityGateStatus {
  if (assessments.some((item) => item.status === "blocked")) return "blocked";
  if (assessments.some((item) => item.status === "warning")) return "warning";
  return "pass";
}

/**
 * Pure and intentionally configurable: no stage assumes hidden business rules.
 * Consumers later supply their stage's required concepts/context readiness.
 */
export function evaluateCampaignUnderstandingQualityGate(
  understanding: CampaignUnderstanding,
  requirements: StageQualityGateRequirements
): StageQualityGateResult {
  const issues = issuesForStage(validateCampaignUnderstanding(understanding), requirements.stage);
  const coverage = deriveUnderstandingCoverage(understanding);
  const sourceCoverageBlocked = issues.filter((issue) => issue.code === "UNREPRESENTED_MATERIAL_SOURCE");
  const traceabilityBlocked = issues.filter(
    (issue) => issue.code === "MISSING_SOURCE_EVIDENCE" || issue.code === "UNKNOWN_EVIDENCE_BLOCK"
  );
  const conflictBlocked = issues.filter((issue) => issue.code === "OPEN_BLOCKING_CONFLICT");
  const constraintBlocked = issues.filter((issue) => issue.code === "ACTIVE_BLOCKING_CONSTRAINT");
  const blockingFacts = issues.filter((issue) => issue.code === "ACTIVE_BLOCKING_FACT");
  const missingInputBlocked = issues.filter((issue) => issue.code === "OPEN_BLOCKING_QUESTION");
  const unsupported = issues.filter((issue) => issue.code === "UNRESOLVED_CLASSIFICATION");
  const missingConcepts = (requirements.requiredFactConcepts ?? []).filter(
    (concept) => !understanding.facts.some((fact) => fact.concept === concept && fact.status !== "unsupported")
  );
  const defaultFacts = understanding.facts.filter(
    (fact) => (fact.origin === "HEURISTIC_DEFAULT" || fact.origin === "AI_RECOMMENDED") && !fact.disclosure
  );
  const lowConfidenceFacts = understanding.facts.filter(
    (fact) =>
      requirements.minimumConfidence !== undefined &&
      fact.materiality !== "context" &&
      fact.confidence !== undefined &&
      fact.confidence < requirements.minimumConfidence
  );

  const assessments: QualityGateAssessment[] = [
    assessment(
      "source_coverage",
      sourceCoverageBlocked.length ? "blocked" : "pass",
      sourceCoverageBlocked.length
        ? "Material source content is not represented."
        : `${coverage.representedMaterialSourceBlockCount}/${coverage.materialSourceBlockCount} material source blocks are represented.`,
      sourceCoverageBlocked.map((issue) => issue.subjectId!).filter(Boolean)
    ),
    assessment(
      "traceability",
      traceabilityBlocked.length ? "blocked" : "pass",
      traceabilityBlocked.length ? "Source-stated requirements lack valid evidence." : "Source-stated requirements retain evidence.",
      traceabilityBlocked.map((issue) => issue.subjectId!).filter(Boolean)
    ),
    assessment(
      "confirmation",
      requirements.requiresConfirmation && understanding.confirmation.status !== "confirmed" ? "warning" : "pass",
      requirements.requiresConfirmation && understanding.confirmation.status !== "confirmed"
        ? "This stage is awaiting operator confirmation."
        : "Confirmation requirements are satisfied."
    ),
    assessment(
      "constraint_status",
      constraintBlocked.length || blockingFacts.length ? "blocked" : "pass",
      constraintBlocked.length || blockingFacts.length
        ? "Active blocking constraints or requirements apply to this stage."
        : "No active blocking constraints or requirements apply to this stage.",
      [...constraintBlocked, ...blockingFacts].map((issue) => issue.subjectId!).filter(Boolean)
    ),
    assessment(
      "conflict_status",
      conflictBlocked.length ? "blocked" : "pass",
      conflictBlocked.length ? "Blocking conflicts require resolution." : "No blocking conflicts apply to this stage.",
      conflictBlocked.map((issue) => issue.subjectId!).filter(Boolean)
    ),
    assessment(
      "missing_inputs",
      missingInputBlocked.length || missingConcepts.length ? "blocked" : "pass",
      missingInputBlocked.length || missingConcepts.length
        ? "Decision-critical inputs are missing."
        : "Required inputs are present.",
      [...missingInputBlocked.map((issue) => issue.subjectId!), ...missingConcepts].filter(Boolean)
    ),
    assessment(
      "unsupported_concepts",
      unsupported.length ? "blocked" : "pass",
      unsupported.length ? "Material requirements still need classification." : "No material requirement is unclassified.",
      unsupported.map((issue) => issue.subjectId!).filter(Boolean)
    ),
    assessment(
      "confidence_review",
      lowConfidenceFacts.length ? "warning" : "pass",
      lowConfidenceFacts.length ? "Material facts need confidence review." : "Confidence review requirements are satisfied.",
      lowConfidenceFacts.map((fact) => fact.id)
    ),
    assessment(
      "default_disclosure",
      defaultFacts.length ? "warning" : "pass",
      defaultFacts.length ? "Defaults or AI recommendations need disclosure." : "Defaults and recommendations are disclosed.",
      defaultFacts.map((fact) => fact.id)
    ),
    assessment(
      "context_readiness",
      requirements.contextReady === false ? "blocked" : "pass",
      requirements.contextReady === false ? "Required specialist context is not ready." : "Required specialist context is ready."
    ),
  ];

  return { stage: requirements.stage, status: aggregateStatus(assessments), assessments };
}
