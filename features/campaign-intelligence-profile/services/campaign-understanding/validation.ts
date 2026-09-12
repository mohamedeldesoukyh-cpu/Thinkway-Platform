import { CAMPAIGN_UNDERSTANDING_SCHEMA_VERSION } from "../../types/campaign-understanding";
import type {
  CampaignUnderstanding,
  CampaignUnderstandingStage,
  EvidenceReference,
  FactScope,
  SemanticFact,
  UnderstandingCoverage,
  UnderstandingValidationIssue,
} from "../../types/campaign-understanding";

function affectsStage(stages: CampaignUnderstandingStage[] | undefined, stage: CampaignUnderstandingStage): boolean {
  return !stages || stages.includes(stage);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function scopeIdentity(scope: FactScope | undefined): string {
  if (!scope) return "global";
  return stableJson({
    selectors: scope.selectors
      .map((selector) => ({ ...selector, values: [...selector.values].sort() }))
      .sort((left, right) => stableJson(left).localeCompare(stableJson(right))),
  });
}

function evidenceExists(understanding: CampaignUnderstanding, evidence: EvidenceReference): "ok" | "document" | "block" {
  const document = understanding.sourceDocuments.find((item) => item.id === evidence.sourceDocumentId);
  if (!document) return "document";
  return document.blocks.some((block) => block.id === evidence.sourceBlockId) ? "ok" : "block";
}

export function hasSourceEvidence(fact: SemanticFact): boolean {
  return fact.evidence.length > 0;
}

/** Derived from canonical documents and evidence, never maintained as parallel input. */
export function deriveUnderstandingCoverage(understanding: CampaignUnderstanding): UnderstandingCoverage {
  const materialBlocks = understanding.sourceDocuments.flatMap((document) =>
    document.blocks.filter((block) => block.material).map((block) => ({ sourceDocumentId: document.id, sourceBlockId: block.id }))
  );
  const represented = new Set(
    [...understanding.facts.flatMap((fact) => fact.evidence), ...understanding.constraints.flatMap((constraint) => constraint.evidence)].map(
      (evidence) => `${evidence.sourceDocumentId}:${evidence.sourceBlockId}`
    )
  );
  const unrepresentedMaterialSourceBlockIds = materialBlocks.filter(
    (block) => !represented.has(`${block.sourceDocumentId}:${block.sourceBlockId}`)
  );
  return {
    sourceDocumentCount: understanding.sourceDocuments.length,
    sourceBlockCount: understanding.sourceDocuments.reduce((total, document) => total + document.blocks.length, 0),
    materialSourceBlockCount: materialBlocks.length,
    representedMaterialSourceBlockCount: materialBlocks.length - unrepresentedMaterialSourceBlockIds.length,
    unrepresentedMaterialSourceBlockIds,
  };
}

function validateEvidence(
  understanding: CampaignUnderstanding,
  evidence: EvidenceReference[],
  subjectId: string,
  issues: UnderstandingValidationIssue[]
): void {
  for (const item of evidence) {
    const result = evidenceExists(understanding, item);
    if (result === "document") {
      issues.push({
        code: "UNKNOWN_EVIDENCE_DOCUMENT",
        message: "Evidence must reference a retained source document.",
        subjectId,
      });
    } else if (result === "block") {
      issues.push({
        code: "UNKNOWN_EVIDENCE_BLOCK",
        message: "Evidence must reference a retained source material block in its named document.",
        subjectId,
      });
    }
  }
}

/** Pure structural validation; parser validation remains the untrusted-input boundary. */
export function validateCampaignUnderstanding(understanding: CampaignUnderstanding): UnderstandingValidationIssue[] {
  const issues: UnderstandingValidationIssue[] = [];
  if (understanding.schemaVersion !== CAMPAIGN_UNDERSTANDING_SCHEMA_VERSION) {
    issues.push({ code: "INVALID_SCHEMA_VERSION", message: "Campaign Understanding schema version is unsupported." });
  }

  const factIds = new Set(understanding.facts.map((fact) => fact.id));
  const factIdentity = new Map<string, SemanticFact>();
  for (const fact of understanding.facts) {
    if (fact.origin === "SOURCE_STATED" && !hasSourceEvidence(fact)) {
      issues.push({ code: "MISSING_SOURCE_EVIDENCE", message: "A source-stated fact must retain evidence.", subjectId: fact.id });
    }
    validateEvidence(understanding, fact.evidence, fact.id, issues);

    if ((fact.status === "needs_classification" || fact.status === "unsupported") && fact.materiality !== "context") {
      issues.push({
        code: "UNRESOLVED_CLASSIFICATION",
        message: "A material requirement needs classification before it can be treated as understood.",
        subjectId: fact.id,
        stages: fact.appliesToStages,
      });
    }
    if (fact.confidence !== undefined && (fact.confidence < 0 || fact.confidence > 1)) {
      issues.push({ code: "INVALID_CONFIDENCE", message: "Fact confidence must be between 0 and 1.", subjectId: fact.id });
    }
    if (fact.origin === "DERIVED" && !fact.derivation?.derivedFromFactIds.length) {
      issues.push({ code: "MISSING_DERIVATION_LINEAGE", message: "A derived fact must retain source fact lineage.", subjectId: fact.id });
    }
    for (const sourceFactId of fact.derivation?.derivedFromFactIds ?? []) {
      if (sourceFactId === fact.id) {
        issues.push({ code: "SELF_DERIVATION", message: "A fact cannot derive from itself.", subjectId: fact.id });
      } else if (!factIds.has(sourceFactId)) {
        issues.push({ code: "INVALID_FACT_REFERENCE", message: "Derived fact lineage references an unknown fact.", subjectId: fact.id, relatedSubjectIds: [sourceFactId] });
      }
    }
    if (fact.materiality === "blocking" && fact.status !== "unsupported") {
      issues.push({
        code: "ACTIVE_BLOCKING_FACT",
        message: "A blocking semantic fact remains active for this stage.",
        subjectId: fact.id,
        stages: fact.appliesToStages,
      });
    }

    const identity = `${fact.concept}:${scopeIdentity(fact.scope)}`;
    const prior = factIdentity.get(identity);
    if (prior && stableJson(prior.value) !== stableJson(fact.value) && prior.status === fact.status) {
      issues.push({
        code: "FACT_COLLISION",
        message: "Facts with the same concept and scope have incompatible values.",
        subjectId: fact.id,
        relatedSubjectIds: [prior.id],
        stages: fact.appliesToStages,
      });
    } else if (!prior) {
      factIdentity.set(identity, fact);
    }
  }

  for (const constraint of understanding.constraints) {
    if (constraint.origin === "SOURCE_STATED" && constraint.evidence.length === 0) {
      issues.push({ code: "MISSING_SOURCE_EVIDENCE", message: "A source-stated constraint must retain evidence.", subjectId: constraint.id });
    }
    validateEvidence(understanding, constraint.evidence, constraint.id, issues);
    if (constraint.severity === "blocking" && constraint.status === "active") {
      issues.push({
        code: "ACTIVE_BLOCKING_CONSTRAINT",
        message: "A blocking campaign constraint remains active for this stage.",
        subjectId: constraint.id,
        stages: constraint.appliesToStages,
      });
    }
  }

  for (const conflict of understanding.conflicts) {
    for (const factId of conflict.factIds) {
      if (!factIds.has(factId)) {
        issues.push({
          code: "INVALID_CONFLICT_REFERENCE",
          message: "A conflict must reference retained facts.",
          subjectId: conflict.id,
          relatedSubjectIds: [factId],
          stages: conflict.appliesToStages,
        });
      }
    }
    if (conflict.status === "open" && conflict.severity === "blocking") {
      issues.push({ code: "OPEN_BLOCKING_CONFLICT", message: "A blocking requirement conflict remains open.", subjectId: conflict.id, stages: conflict.appliesToStages });
    }
  }

  for (const question of understanding.questions) {
    for (const factId of question.relatedFactIds ?? []) {
      if (!factIds.has(factId)) {
        issues.push({ code: "INVALID_FACT_REFERENCE", message: "A question references an unknown fact.", subjectId: question.id, relatedSubjectIds: [factId], stages: question.appliesToStages });
      }
    }
    if (question.status === "open" && question.severity === "blocking") {
      issues.push({ code: "OPEN_BLOCKING_QUESTION", message: "Decision-critical campaign information is still missing.", subjectId: question.id, stages: question.appliesToStages });
    }
  }

  for (const factId of understanding.confirmation.confirmedFactIds) {
    if (!factIds.has(factId)) {
      issues.push({ code: "INVALID_CONFIRMATION_REFERENCE", message: "Confirmation references an unknown fact.", subjectId: factId });
    }
  }

  for (const block of deriveUnderstandingCoverage(understanding).unrepresentedMaterialSourceBlockIds) {
    issues.push({
      code: "UNREPRESENTED_MATERIAL_SOURCE",
      message: "A material source block is not represented by a semantic fact or constraint.",
      subjectId: `${block.sourceDocumentId}:${block.sourceBlockId}`,
    });
  }
  return issues;
}

export function issuesForStage(issues: UnderstandingValidationIssue[], stage: CampaignUnderstandingStage): UnderstandingValidationIssue[] {
  return issues.filter((issue) => !issue.stages || affectsStage(issue.stages, stage));
}
