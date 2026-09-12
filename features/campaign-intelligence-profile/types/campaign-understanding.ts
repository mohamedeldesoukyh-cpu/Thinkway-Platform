/**
 * Additive, versioned contract for campaign requirements that cannot safely be
 * represented by the fixed Campaign Facts projection alone. This is not yet
 * persisted or consumed by Studio workflows.
 */
export const CAMPAIGN_UNDERSTANDING_SCHEMA_VERSION = 1 as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type FactOrigin =
  | "SOURCE_STATED"
  | "OPERATOR_STATED"
  | "INFERRED"
  | "DERIVED"
  | "HEURISTIC_DEFAULT"
  | "AI_RECOMMENDED"
  | "LEGACY_UNVERIFIED";

export type CampaignUnderstandingStage =
  | "strategy"
  | "discovery"
  | "creator_planning"
  | "content"
  | "commercial"
  | "package";

export type FactStatus =
  | "confirmed"
  | "proposed"
  | "open"
  | "conflicted"
  | "needs_classification"
  | "unsupported";

export type FactMateriality = "context" | "important" | "decision_critical" | "blocking";

export type ScopeDimension =
  | "market"
  | "product"
  | "audience_segment"
  | "platform"
  | "creator"
  | "phase"
  | "wave"
  | "deliverable";

/**
 * Selectors in one scope are conjunctive. Values in an `in` selector are an
 * explicit membership set, never an implied pairing or Cartesian product.
 * Paired market/platform requirements are represented by separate scoped facts.
 */
export type ScopeSelector = {
  dimension: ScopeDimension;
  operator: "is" | "in" | "not_in";
  values: string[];
};

export type FactScope = {
  selectors: ScopeSelector[];
};

export type EvidenceLocation = {
  page?: number;
  section?: string;
  table?: string;
  row?: number;
  column?: string;
  appendix?: string;
};

export type EvidenceReference = {
  sourceDocumentId: string;
  sourceBlockId: string;
  excerpt: string;
  location?: EvidenceLocation;
};

export type SourceMaterialBlock = {
  id: string;
  kind: "paragraph" | "heading" | "list" | "table" | "appendix" | "operator_note" | "other";
  text: string;
  material: boolean;
};

export type SourceDocument = {
  id: string;
  kind: "brief" | "appendix" | "legal" | "commercial_attachment" | "annex" | "other";
  title?: string;
  blocks: SourceMaterialBlock[];
};

/** A small declarative condition model, intentionally not a programming language. */
export type RequirementConditionClause = {
  factConcept: string;
  operator: "is" | "includes" | "selected";
  value?: JsonValue;
  scope?: FactScope;
};

export type RequirementCondition = {
  operator: "all" | "any";
  clauses: RequirementConditionClause[];
};

export type FactDerivation = {
  derivedFromFactIds: string[];
  method?: "normalization" | "calculation" | "aggregation" | "other";
  reason?: string;
};

export type SemanticFact = {
  id: string;
  /** Extensible semantic key; unknown concepts must be retained, not dropped. */
  concept: string;
  label: string;
  value: JsonValue;
  origin: FactOrigin;
  status: FactStatus;
  materiality: FactMateriality;
  scope?: FactScope;
  condition?: RequirementCondition;
  evidence: EvidenceReference[];
  /** Required for DERIVED facts; retains semantic lineage without relabelling source origin. */
  derivation?: FactDerivation;
  appliesToStages?: CampaignUnderstandingStage[];
  confidence?: number;
  /** Defaults and recommendations must remain visible as such to operators. */
  disclosure?: string;
};

export type CampaignConstraint = {
  id: string;
  kind: "legal" | "commercial_rights" | "creator" | "brand_safety" | "operational" | "other";
  statement: string;
  severity: "warning" | "blocking";
  origin: FactOrigin;
  status: "active" | "resolved" | "needs_classification";
  scope?: FactScope;
  condition?: RequirementCondition;
  evidence: EvidenceReference[];
  appliesToStages?: CampaignUnderstandingStage[];
};

export type UnderstandingQuestion = {
  id: string;
  prompt: string;
  severity: "warning" | "blocking";
  status: "open" | "answered" | "not_applicable";
  appliesToStages: CampaignUnderstandingStage[];
  relatedFactIds?: string[];
};

export type UnderstandingConflict = {
  id: string;
  summary: string;
  severity: "warning" | "blocking";
  status: "open" | "resolved";
  factIds: string[];
  appliesToStages?: CampaignUnderstandingStage[];
};

/** Computed from source documents and retained evidence; never parallel persisted state. */
export type UnderstandingCoverage = {
  sourceDocumentCount: number;
  sourceBlockCount: number;
  materialSourceBlockCount: number;
  representedMaterialSourceBlockCount: number;
  unrepresentedMaterialSourceBlockIds: Array<{ sourceDocumentId: string; sourceBlockId: string }>;
};

export type UnderstandingConfirmation = {
  status: "unconfirmed" | "partially_confirmed" | "confirmed";
  confirmedFactIds: string[];
  confirmedAt?: string;
  confirmedBy?: string;
};

export type CampaignUnderstanding = {
  schemaVersion: typeof CAMPAIGN_UNDERSTANDING_SCHEMA_VERSION;
  campaignId?: string;
  sourceDocuments: SourceDocument[];
  facts: SemanticFact[];
  constraints: CampaignConstraint[];
  questions: UnderstandingQuestion[];
  conflicts: UnderstandingConflict[];
  confirmation: UnderstandingConfirmation;
};

export type UnderstandingValidationIssue = {
  code:
    | "INVALID_SCHEMA_VERSION"
    | "MISSING_SOURCE_EVIDENCE"
    | "UNKNOWN_EVIDENCE_DOCUMENT"
    | "UNKNOWN_EVIDENCE_BLOCK"
    | "UNREPRESENTED_MATERIAL_SOURCE"
    | "UNRESOLVED_CLASSIFICATION"
    | "OPEN_BLOCKING_CONFLICT"
    | "OPEN_BLOCKING_QUESTION"
    | "ACTIVE_BLOCKING_CONSTRAINT"
    | "ACTIVE_BLOCKING_FACT"
    | "INVALID_CONFIDENCE"
    | "MISSING_DERIVATION_LINEAGE"
    | "INVALID_FACT_REFERENCE"
    | "SELF_DERIVATION"
    | "INVALID_CONFLICT_REFERENCE"
    | "INVALID_CONFIRMATION_REFERENCE"
    | "FACT_COLLISION";
  message: string;
  subjectId?: string;
  relatedSubjectIds?: string[];
  stages?: CampaignUnderstandingStage[];
};

export type QualityGateDimension =
  | "source_coverage"
  | "traceability"
  | "confirmation"
  | "constraint_status"
  | "conflict_status"
  | "missing_inputs"
  | "unsupported_concepts"
  | "confidence_review"
  | "default_disclosure"
  | "context_readiness";

export type QualityGateStatus = "pass" | "warning" | "blocked";

export type QualityGateAssessment = {
  dimension: QualityGateDimension;
  status: QualityGateStatus;
  reason: string;
  subjectIds?: string[];
};

export type StageQualityGateRequirements = {
  stage: CampaignUnderstandingStage;
  requiredFactConcepts?: string[];
  requiresConfirmation?: boolean;
  minimumConfidence?: number;
  contextReady?: boolean;
};

export type StageQualityGateResult = {
  stage: CampaignUnderstandingStage;
  status: QualityGateStatus;
  assessments: QualityGateAssessment[];
};
