import type {
  CampaignUnderstanding,
  CampaignUnderstandingStage,
  FactOrigin,
  FactScope,
  RequirementCondition,
  ScopeDimension,
  SemanticFact,
  SourceDocument,
  SourceMaterialBlock,
  UnderstandingValidationIssue,
} from "../../types/campaign-understanding";

export type ParserReadyInputFixture = {
  sourceDocuments: Array<{
    id: string;
    kind: SourceDocument["kind"];
    rawText: string;
    structuredBlocks: SourceMaterialBlock[];
  }>;
};

export type SemanticAssertion =
  | { kind: "source_block_preserved"; sourceDocumentId: string; sourceBlockId: string }
  | { kind: "fact_represented"; concept: string }
  | { kind: "fact_not_represented"; concept: string }
  | { kind: "source_evidence_exists"; concept: string }
  | { kind: "origin_is"; concept: string; origin: FactOrigin }
  | { kind: "scope_is"; concept: string; scope: FactScope }
  | { kind: "condition_is"; concept: string; condition: RequirementCondition }
  | { kind: "status_is"; concept: string; status: SemanticFact["status"] }
  | { kind: "constraint_is_blocking"; kindValue: string; stage?: CampaignUnderstandingStage }
  | { kind: "question_open"; stage: CampaignUnderstandingStage }
  | { kind: "conflict_retained" }
  | { kind: "stage_status"; stage: CampaignUnderstandingStage; status: "pass" | "warning" | "blocked" };

export type GoldenBriefScenario = {
  id: string;
  title: string;
  sourceShape: "flat" | "headings_and_lists" | "table" | "appendix" | "mixed";
  input: ParserReadyInputFixture;
  understanding: CampaignUnderstanding;
  assertions: SemanticAssertion[];
  expectedValidationIssueCodes: UnderstandingValidationIssue["code"][];
};

function block(id: string, text: string, kind: SourceMaterialBlock["kind"] = "paragraph"): SourceMaterialBlock {
  return { id, text, kind, material: true };
}

function document(id: string, kind: SourceDocument["kind"], blocks: SourceMaterialBlock[]): SourceDocument {
  return { id, kind, blocks };
}

function select(dimension: ScopeDimension, ...values: string[]) {
  return { dimension, operator: values.length === 1 ? ("is" as const) : ("in" as const), values };
}

function scope(...selectors: FactScope["selectors"]): FactScope {
  return { selectors };
}

function fact(
  id: string,
  concept: string,
  value: SemanticFact["value"],
  sourceBlockId: string,
  overrides: Partial<SemanticFact> = {},
  sourceDocumentId = "brief"
): SemanticFact {
  return {
    id,
    concept,
    label: concept.replaceAll("_", " "),
    value,
    origin: "SOURCE_STATED",
    status: "confirmed",
    materiality: "important",
    evidence: [{ sourceDocumentId, sourceBlockId, excerpt: sourceBlockId }],
    confidence: 0.9,
    ...overrides,
  };
}

function understanding(
  sourceDocuments: SourceDocument[],
  facts: SemanticFact[],
  overrides: Partial<CampaignUnderstanding> = {}
): CampaignUnderstanding {
  return {
    schemaVersion: 1,
    sourceDocuments,
    facts,
    constraints: [],
    questions: [],
    conflicts: [],
    confirmation: { status: "confirmed", confirmedFactIds: facts.map((item) => item.id) },
    ...overrides,
  };
}

function withInput(scenario: Omit<GoldenBriefScenario, "input">): GoldenBriefScenario {
  return {
    ...scenario,
    input: {
      sourceDocuments: scenario.understanding.sourceDocuments.map((source) => ({
        id: source.id,
        kind: source.kind,
        rawText: source.blocks.map((item) => item.text).join("\n"),
        structuredBlocks: source.blocks,
      })),
    },
  };
}

export const GOLDEN_BRIEF_CORPUS: GoldenBriefScenario[] = [
  withInput({
    id: "single-market-awareness", title: "Simple single-market campaign", sourceShape: "flat",
    understanding: understanding([document("brief", "brief", [block("brief", "Egypt awareness campaign on Instagram")])], [
      fact("market", "market", "Egypt", "brief"), fact("platform", "primary_platform", "Instagram", "brief"),
    ]),
    assertions: [
      { kind: "source_block_preserved", sourceDocumentId: "brief", sourceBlockId: "brief" },
      { kind: "fact_represented", concept: "primary_platform" },
      { kind: "fact_not_represented", concept: "platform_membership" },
      { kind: "source_evidence_exists", concept: "primary_platform" },
    ], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "multi-market-localized", title: "Multi-market campaign with country-specific requirements", sourceShape: "headings_and_lists",
    understanding: understanding([document("brief", "brief", [block("egypt", "Egypt requires Arabic creators", "list"), block("ksa", "KSA requires Saudi disclosure", "list")])], [
      fact("egypt-language", "creator_language", "Arabic", "egypt", { scope: scope(select("market", "Egypt")) }),
      fact("ksa-disclosure", "disclosure_requirement", "Saudi disclosure", "ksa", { scope: scope(select("market", "Saudi Arabia")) }),
    ]),
    assertions: [{ kind: "scope_is", concept: "creator_language", scope: scope(select("market", "Egypt")) }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "ambassador-waves", title: "Multi-wave long-term ambassador campaign", sourceShape: "headings_and_lists",
    understanding: understanding([document("brief", "brief", [block("wave-one", "Wave 1: launch ambassador", "heading"), block("wave-two", "Wave 2: retain ambassador", "heading")])], [
      fact("wave-one-ambassador", "ambassador_requirement", "launch", "wave-one", { scope: scope(select("wave", "1")) }),
      fact("wave-two-ambassador", "ambassador_requirement", "retain", "wave-two", { scope: scope(select("wave", "2")) }),
    ]),
    assertions: [{ kind: "scope_is", concept: "ambassador_requirement", scope: scope(select("wave", "1")) }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "regulated-claims", title: "Regulated campaign with legal claim restrictions", sourceShape: "appendix",
    understanding: understanding([document("legal", "legal", [block("approval", "No efficacy claim without legal approval", "appendix")])], [
      fact("claims", "claims_review", "legal approval", "approval", { materiality: "blocking", appliesToStages: ["content", "package"] }, "legal"),
    ], { constraints: [{ id: "legal-claim-approval", kind: "legal", statement: "Claims require legal approval.", severity: "blocking", origin: "SOURCE_STATED", status: "active", evidence: [{ sourceDocumentId: "legal", sourceBlockId: "approval", excerpt: "legal approval" }], appliesToStages: ["content", "package"] }] }),
    assertions: [{ kind: "constraint_is_blocking", kindValue: "legal", stage: "content" }, { kind: "stage_status", stage: "strategy", status: "pass" }, { kind: "stage_status", stage: "content", status: "blocked" }],
    expectedValidationIssueCodes: ["ACTIVE_BLOCKING_FACT", "ACTIVE_BLOCKING_CONSTRAINT"],
  }),
  withInput({
    id: "performance-kpis", title: "Performance conversion campaign with measurable KPIs", sourceShape: "table",
    understanding: understanding([document("brief", "brief", [block("kpi-table", "KPI matrix: CPA 120; conversions 500", "table")])], [fact("kpi", "performance_kpi", { cpa: 120, conversions: 500 }, "kpi-table")]),
    assertions: [{ kind: "fact_represented", concept: "performance_kpi" }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "event-phases", title: "Event campaign with pre, live and post phases", sourceShape: "headings_and_lists",
    understanding: understanding([document("brief", "brief", [block("pre", "Pre-event teaser", "heading"), block("live", "Live coverage", "heading"), block("post", "Post-event recap", "heading")])], [
      fact("pre-content", "content_requirement", "teaser", "pre", { scope: scope(select("phase", "pre")) }),
      fact("live-content", "content_requirement", "live coverage", "live", { scope: scope(select("phase", "live")) }),
      fact("post-content", "content_requirement", "recap", "post", { scope: scope(select("phase", "post")) }),
    ]),
    assertions: [{ kind: "scope_is", concept: "content_requirement", scope: scope(select("phase", "pre")) }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "creator-constraints", title: "Mandatory, excluded and tier-specific creator constraints", sourceShape: "mixed",
    understanding: understanding([document("brief", "brief", [block("creator-rules", "Use named ambassador; exclude competitor creators; include two macro creators", "list")])], [
      fact("mandatory", "mandatory_creator", "Creator A", "creator-rules"),
      fact("excluded", "excluded_creator", "Competitor spokespersons", "creator-rules", { materiality: "blocking", appliesToStages: ["discovery", "creator_planning"] }),
      fact("tier", "creator_tier_count", { tier: "macro", count: 2 }, "creator-rules"),
    ]),
    assertions: [{ kind: "fact_represented", concept: "excluded_creator" }, { kind: "origin_is", concept: "creator_tier_count", origin: "SOURCE_STATED" }, { kind: "stage_status", stage: "discovery", status: "blocked" }],
    expectedValidationIssueCodes: ["ACTIVE_BLOCKING_FACT"],
  }),
  withInput({
    id: "commercial-rights", title: "Commercial usage, boosting, whitelisting and exclusivity rights", sourceShape: "appendix",
    understanding: understanding([document("brief", "brief", [block("amplification", "Paid amplification may be selected")]), document("rights", "commercial_attachment", [block("rights", "Six-month usage, boosting, whitelisting and exclusivity", "appendix")])], [
      fact("amplification", "paid_amplification", true, "amplification"),
      fact("rights", "commercial_rights", ["usage", "boosting", "whitelisting", "exclusivity"], "rights", {}, "rights"),
      fact("approval", "brand_approval_required", true, "rights", { condition: { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] } }, "rights"),
    ]),
    assertions: [{ kind: "fact_represented", concept: "commercial_rights" }, { kind: "condition_is", concept: "brand_approval_required", condition: { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] } }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "missing-budget", title: "Incomplete campaign with missing budget", sourceShape: "flat",
    understanding: understanding([document("brief", "brief", [block("goal", "Launch new service in Egypt")])], [fact("goal", "campaign_objective", "launch", "goal")], { questions: [{ id: "budget-needed", prompt: "What budget is approved?", severity: "blocking", status: "open", appliesToStages: ["commercial", "package"] }] }),
    assertions: [{ kind: "fact_not_represented", concept: "budget" }, { kind: "question_open", stage: "commercial" }, { kind: "stage_status", stage: "strategy", status: "pass" }, { kind: "stage_status", stage: "commercial", status: "blocked" }], expectedValidationIssueCodes: ["OPEN_BLOCKING_QUESTION"],
  }),
  withInput({
    id: "contradictory-requirements", title: "Contradictory campaign requirements", sourceShape: "mixed",
    understanding: understanding([document("brief", "brief", [block("fast", "Launch in one week"), block("approval", "All content needs four-week approval")])], [fact("launch", "launch_timing", "one week", "fast"), fact("approval", "approval_timing", "four weeks", "approval")], { conflicts: [{ id: "timing-conflict", summary: "Launch and approval windows conflict.", severity: "blocking", status: "open", factIds: ["launch", "approval"], appliesToStages: ["strategy", "content"] }] }),
    assertions: [{ kind: "conflict_retained" }, { kind: "stage_status", stage: "strategy", status: "blocked" }], expectedValidationIssueCodes: ["OPEN_BLOCKING_CONFLICT"],
  }),
  withInput({
    id: "explicit-creator-strategy", title: "Campaign where creator strategy is explicitly specified", sourceShape: "table",
    understanding: understanding([document("brief", "brief", [block("mix", "Creator Mix | Celebrity: 1 | Micro: 3", "table")])], [fact("mix", "creator_strategy", { celebrity: 1, micro: 3 }, "mix")]),
    assertions: [{ kind: "origin_is", concept: "creator_strategy", origin: "SOURCE_STATED" }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "open-creator-recommendation", title: "Campaign where creator strategy is intentionally open for recommendation", sourceShape: "flat",
    understanding: understanding([document("brief", "brief", [block("open-mix", "Recommend the right creator mix")])], [fact("open-mix", "creator_strategy", "open for Thinkway recommendation", "open-mix", { status: "open" })]),
    assertions: [{ kind: "status_is", concept: "creator_strategy", status: "open" }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "table-appendix-heavy", title: "Table and appendix-heavy brief", sourceShape: "mixed",
    understanding: understanding([document("brief", "brief", [block("matrix", "Market | Deliverable; Egypt | Reel; KSA | Story", "table")]), document("annex", "annex", [block("appendix", "Brand safety appendix", "appendix")])], [fact("matrix", "deliverable_matrix", { Egypt: ["reel"], KSA: ["story"] }, "matrix"), fact("brand-safety", "brand_safety", "appendix rules", "appendix", {}, "annex")]),
    assertions: [{ kind: "source_block_preserved", sourceDocumentId: "brief", sourceBlockId: "matrix" }, { kind: "source_block_preserved", sourceDocumentId: "annex", sourceBlockId: "appendix" }], expectedValidationIssueCodes: [],
  }),
  withInput({
    id: "unknown-material-requirement", title: "Unknown unanticipated material requirement", sourceShape: "appendix",
    understanding: understanding([document("brief", "brief", [block("unknown", "Apply the client's proprietary resonance protocol", "appendix")])], [fact("unknown", "unclassified:proprietary_resonance_protocol", "required", "unknown", { status: "needs_classification", materiality: "blocking", appliesToStages: ["discovery", "creator_planning"] })]),
    assertions: [{ kind: "status_is", concept: "unclassified:proprietary_resonance_protocol", status: "needs_classification" }, { kind: "stage_status", stage: "discovery", status: "blocked" }], expectedValidationIssueCodes: ["UNRESOLVED_CLASSIFICATION", "ACTIVE_BLOCKING_FACT"],
  }),
  withInput({
    id: "complex-combined", title: "Complex combined multi-market, wave, rights, legal and audience campaign", sourceShape: "mixed",
    understanding: understanding([document("brief", "brief", [block("egypt", "Egypt youth audience on TikTok", "table"), block("ksa", "KSA family audience on Instagram", "table")]), document("rights", "commercial_attachment", [block("rights", "Paid usage rights by market", "appendix")]), document("legal", "legal", [block("legal", "Claims need legal approval", "appendix")])], [
      fact("egypt-audience", "audience_requirement", "youth", "egypt", { scope: scope(select("market", "Egypt"), select("platform", "TikTok"), select("wave", "1")) }),
      fact("ksa-audience", "audience_requirement", "families", "ksa", { scope: scope(select("market", "Saudi Arabia"), select("platform", "Instagram"), select("wave", "2")) }),
      fact("rights", "commercial_rights", "paid usage", "rights", { scope: scope(select("market", "Egypt", "Saudi Arabia")) }, "rights"),
      fact("legal", "claims_review", "legal approval", "legal", { materiality: "blocking", appliesToStages: ["content", "package"] }, "legal"),
    ], { constraints: [{ id: "complex-legal", kind: "legal", statement: "Legal approval is required before claim publication.", severity: "blocking", origin: "SOURCE_STATED", status: "active", evidence: [{ sourceDocumentId: "legal", sourceBlockId: "legal", excerpt: "legal approval" }], appliesToStages: ["content", "package"] }] }),
    assertions: [{ kind: "scope_is", concept: "audience_requirement", scope: scope(select("market", "Egypt"), select("platform", "TikTok"), select("wave", "1")) }, { kind: "constraint_is_blocking", kindValue: "legal", stage: "content" }, { kind: "stage_status", stage: "content", status: "blocked" }], expectedValidationIssueCodes: ["ACTIVE_BLOCKING_FACT", "ACTIVE_BLOCKING_CONSTRAINT"],
  }),
];
