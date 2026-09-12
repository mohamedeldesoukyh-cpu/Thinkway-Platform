import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignUnderstanding, FactScope } from "../../types/campaign-understanding";
import { parseCampaignUnderstanding } from "./campaign-understanding-schema";
import { GOLDEN_BRIEF_CORPUS, type GoldenBriefScenario, type SemanticAssertion } from "./golden-brief-corpus";
import { evaluateCampaignUnderstandingQualityGate } from "./quality-gate";
import { deriveUnderstandingCoverage, validateCampaignUnderstanding } from "./validation";

function equalScope(actual: FactScope | undefined, expected: FactScope): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function assertScenarioAssertion(scenario: GoldenBriefScenario, assertion: SemanticAssertion): void {
  const understanding = scenario.understanding;
  switch (assertion.kind) {
    case "source_block_preserved":
      assert.ok(understanding.sourceDocuments.some((document) => document.id === assertion.sourceDocumentId && document.blocks.some((block) => block.id === assertion.sourceBlockId)));
      return;
    case "fact_represented": assert.ok(understanding.facts.some((fact) => fact.concept === assertion.concept)); return;
    case "fact_not_represented": assert.ok(understanding.facts.every((fact) => fact.concept !== assertion.concept)); return;
    case "source_evidence_exists": assert.ok(understanding.facts.some((fact) => fact.concept === assertion.concept && fact.evidence.length > 0)); return;
    case "origin_is": assert.ok(understanding.facts.some((fact) => fact.concept === assertion.concept && fact.origin === assertion.origin)); return;
    case "scope_is": assert.ok(understanding.facts.some((fact) => fact.concept === assertion.concept && equalScope(fact.scope, assertion.scope))); return;
    case "condition_is": assert.ok(understanding.facts.some((fact) => fact.concept === assertion.concept && JSON.stringify(fact.condition) === JSON.stringify(assertion.condition))); return;
    case "status_is": assert.ok(understanding.facts.some((fact) => fact.concept === assertion.concept && fact.status === assertion.status)); return;
    case "constraint_is_blocking": assert.ok(understanding.constraints.some((constraint) => constraint.kind === assertion.kindValue && constraint.severity === "blocking" && (!assertion.stage || constraint.appliesToStages?.includes(assertion.stage)))); return;
    case "question_open": assert.ok(understanding.questions.some((question) => question.status === "open" && question.appliesToStages.includes(assertion.stage))); return;
    case "conflict_retained": assert.ok(understanding.conflicts.some((conflict) => conflict.status === "open")); return;
    case "stage_status": assert.equal(evaluateCampaignUnderstandingQualityGate(understanding, { stage: assertion.stage }).status, assertion.status); return;
  }
}

function cloneScenario(id: string): CampaignUnderstanding {
  return structuredClone(GOLDEN_BRIEF_CORPUS.find((scenario) => scenario.id === id)!.understanding);
}

test("golden brief corpus has fifteen structurally varied parser-ready scenarios", () => {
  assert.equal(GOLDEN_BRIEF_CORPUS.length, 15);
  assert.deepEqual(new Set(GOLDEN_BRIEF_CORPUS.map((scenario) => scenario.sourceShape)), new Set(["flat", "headings_and_lists", "table", "appendix", "mixed"]));
  for (const scenario of GOLDEN_BRIEF_CORPUS) {
    assert.ok(scenario.input.sourceDocuments.length > 0);
    assert.ok(scenario.input.sourceDocuments.every((document) => document.rawText.length > 0 && document.structuredBlocks.length > 0));
  }
});

for (const scenario of GOLDEN_BRIEF_CORPUS) {
  test(`golden corpus preserves semantic invariants: ${scenario.id}`, () => {
    for (const assertion of scenario.assertions) assertScenarioAssertion(scenario, assertion);
    assert.deepEqual(new Set(validateCampaignUnderstanding(scenario.understanding).map((issue) => issue.code)), new Set(scenario.expectedValidationIssueCodes));
  });
}

test("runtime parser rejects malformed Campaign Understanding and accepts the versioned corpus contract", () => {
  assert.doesNotThrow(() => parseCampaignUnderstanding(GOLDEN_BRIEF_CORPUS[0].understanding));
  const malformed = { ...GOLDEN_BRIEF_CORPUS[0].understanding, schemaVersion: 2 };
  assert.throws(() => parseCampaignUnderstanding(malformed));
  const ambiguousScope = structuredClone(GOLDEN_BRIEF_CORPUS[0].understanding);
  ambiguousScope.facts[0].scope = {
    selectors: [
      { dimension: "market", operator: "is", values: ["Egypt"] },
      { dimension: "market", operator: "is", values: ["Saudi Arabia"] },
    ],
  };
  assert.throws(() => parseCampaignUnderstanding(ambiguousScope));
});

test("multi-document evidence validates both document and block identity", () => {
  const valid = cloneScenario("complex-combined");
  assert.equal(validateCampaignUnderstanding(valid).some((issue) => issue.code.startsWith("UNKNOWN_EVIDENCE")), false);
  valid.facts[0].evidence[0].sourceDocumentId = "missing";
  assert.ok(validateCampaignUnderstanding(valid).some((issue) => issue.code === "UNKNOWN_EVIDENCE_DOCUMENT"));
  valid.facts[0].evidence[0].sourceDocumentId = "brief";
  valid.facts[0].evidence[0].sourceBlockId = "missing";
  assert.ok(validateCampaignUnderstanding(valid).some((issue) => issue.code === "UNKNOWN_EVIDENCE_BLOCK"));
});

test("selectors express membership, paired facts, cross-scope requirements, and conditions without Cartesian assumptions", () => {
  const complex = cloneScenario("complex-combined");
  const egypt = complex.facts.find((fact) => fact.id === "egypt-audience")!;
  const ksa = complex.facts.find((fact) => fact.id === "ksa-audience")!;
  assert.notDeepEqual(egypt.scope, ksa.scope);
  assert.deepEqual(complex.facts.find((fact) => fact.id === "rights")!.scope, { selectors: [{ dimension: "market", operator: "in", values: ["Egypt", "Saudi Arabia"] }] });
  const conditional = cloneScenario("commercial-rights").facts.find((fact) => fact.id === "approval")!;
  assert.deepEqual(conditional.condition, { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] });
  const conditionalPatterns = [
    { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] },
    { operator: "all", clauses: [{ factConcept: "creator_market", operator: "is", value: "Saudi Arabia" }] },
    { operator: "all", clauses: [{ factConcept: "event_attendance", operator: "selected" }] },
  ];
  assert.doesNotThrow(() => parseCampaignUnderstanding({
    ...complex,
    facts: complex.facts.map((fact, index) => index < conditionalPatterns.length ? { ...fact, condition: conditionalPatterns[index] } : fact),
  }));
});

test("derived lineage, references, collisions, and confirmation references are validated", () => {
  const understanding = cloneScenario("single-market-awareness");
  understanding.facts.push({ ...understanding.facts[0], id: "derived-market", concept: "normalized_market", origin: "DERIVED", derivation: { derivedFromFactIds: ["market"], method: "normalization" } });
  assert.equal(validateCampaignUnderstanding(understanding).some((issue) => issue.code === "MISSING_DERIVATION_LINEAGE"), false);
  understanding.facts.at(-1)!.derivation = { derivedFromFactIds: ["missing"] };
  understanding.facts.at(-1)!.derivation = { derivedFromFactIds: ["derived-market"] };
  assert.ok(validateCampaignUnderstanding(understanding).some((issue) => issue.code === "SELF_DERIVATION"));
  understanding.facts.at(-1)!.derivation = { derivedFromFactIds: ["missing"] };
  understanding.conflicts.push({ id: "bad-conflict", summary: "bad", severity: "warning", status: "open", factIds: ["market", "missing"] });
  understanding.confirmation.confirmedFactIds.push("missing");
  understanding.facts.push({ ...understanding.facts[0], id: "market-conflict", value: "Saudi Arabia" });
  const codes = new Set(validateCampaignUnderstanding(understanding).map((issue) => issue.code));
  assert.ok(codes.has("INVALID_FACT_REFERENCE"));
  assert.ok(codes.has("INVALID_CONFLICT_REFERENCE"));
  assert.ok(codes.has("INVALID_CONFIRMATION_REFERENCE"));
  assert.ok(codes.has("FACT_COLLISION"));
});

test("quality gates can permit Strategy while blocking only affected later stages", () => {
  const incomplete = cloneScenario("missing-budget");
  assert.equal(evaluateCampaignUnderstandingQualityGate(incomplete, { stage: "strategy" }).status, "pass");
  assert.equal(evaluateCampaignUnderstandingQualityGate(incomplete, { stage: "commercial" }).status, "blocked");
  const legal = cloneScenario("regulated-claims");
  assert.equal(evaluateCampaignUnderstandingQualityGate(legal, { stage: "strategy" }).status, "pass");
  assert.equal(evaluateCampaignUnderstandingQualityGate(legal, { stage: "content" }).status, "blocked");
});

test("operator edits remain distinct from confirmation and coverage is derived", () => {
  const understanding = cloneScenario("single-market-awareness");
  understanding.facts[0].origin = "OPERATOR_STATED";
  understanding.confirmation.status = "confirmed";
  assert.equal(understanding.facts[0].origin, "OPERATOR_STATED");
  assert.equal(deriveUnderstandingCoverage(understanding).unrepresentedMaterialSourceBlockIds.length, 0);
  understanding.facts[0].evidence = [];
  assert.equal(deriveUnderstandingCoverage(understanding).unrepresentedMaterialSourceBlockIds.length, 0);
  understanding.facts[1].evidence = [];
  assert.equal(deriveUnderstandingCoverage(understanding).unrepresentedMaterialSourceBlockIds.length, 1);
});

test("AI recommendations retain AI provenance even when source evidence exists", () => {
  const base = cloneScenario("single-market-awareness");
  base.facts.push({ ...base.facts[0], id: "ai-recommended-mix", concept: "creator_mix_recommendation", origin: "AI_RECOMMENDED", disclosure: "AI recommendation based on source requirements." });
  assert.equal(base.facts.at(-1)?.origin, "AI_RECOMMENDED");
  assert.equal(validateCampaignUnderstanding(base).length, 0);
});
