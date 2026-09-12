import assert from "node:assert/strict";
import test from "node:test";

import { buildStrategyContext } from "./build-strategy-context";
import { GOLDEN_BRIEF_CORPUS } from "./golden-brief-corpus";
import { writeStrategyDocumentFromBrief } from "@/features/campaign-director/services/strategy-document";
import { buildCreatorSearchRequirements } from "@/features/campaign-studio/services/creator-search-requirements/build-creator-search-requirements";

test("StrategyContext retains scoped source requirements without source documents", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS.find((item) => item.id === "complex-combined")!.understanding);
  const context = buildStrategyContext(understanding)!;
  assert.equal(context.campaignUnderstandingRef.confirmationStatus, "confirmed");
  assert.ok(context.scopedRequirements.some((fact) => fact.scope?.selectors.some((selector) => selector.dimension === "market" && selector.values.includes("Egypt"))));
  assert.ok(context.scopedRequirements.some((fact) => fact.scope?.selectors.some((selector) => selector.dimension === "market" && selector.values.includes("Saudi Arabia"))));
  assert.equal("sourceDocuments" in context, false);
});

test("StrategyContext preserves conditional platforms as non-global directives", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS.find((item) => item.id === "commercial-rights")!.understanding);
  understanding.facts.push({
    ...understanding.facts[0], id: "conditional-tiktok", concept: "platform_directive", value: "TikTok",
    condition: { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] },
  });
  const context = buildStrategyContext(understanding)!;
  assert.equal(context.platformDirectives.find((item) => item.platform === "TikTok")?.priority, "conditional");
});

test("unconfirmed understanding never becomes Strategy context", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS[0].understanding);
  understanding.confirmation = { status: "unconfirmed", confirmedFactIds: [] };
  assert.equal(buildStrategyContext(understanding), undefined);
});

test("context changes Strategy and CSR without turning conditional platforms into mandatory filters", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS[0].understanding);
  understanding.facts[1] = { ...understanding.facts[1], concept: "platform_directive" };
  understanding.facts.push(
    { ...understanding.facts[0], id: "tiktok-conditional", concept: "platform_directive", value: "TikTok", condition: { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] } }
  );
  const context = buildStrategyContext(understanding)!;
  const strategy = writeStrategyDocumentFromBrief({ rawMessage: "", campaignFacts: { extractedAt: "2026-01-01T00:00:00.000Z", confidence: {}, sources: {} } }, undefined, context);
  assert.deepEqual(strategy.understanding.platforms, ["Instagram"]);
  assert.notEqual(strategy.understanding.objective, "Brand awareness and engagement");
  const csr = buildCreatorSearchRequirements({ strategy, strategyContext: context, now: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(csr.search.platforms.map((item) => item.value), ["instagram"]);
  assert.equal(csr.strategic.platformDirectives?.find((item) => item.platform === "TikTok")?.priority, "conditional");
});

test("operator precedence does not erase an open source conflict", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS.find((item) => item.id === "contradictory-requirements")!.understanding);
  understanding.facts.push({ ...understanding.facts[0], id: "operator-launch", origin: "OPERATOR_STATED", value: "two weeks" });
  const context = buildStrategyContext(understanding)!;
  assert.ok(context.openConflicts.some((conflict) => conflict.id === "timing-conflict"));
  assert.equal(context.readiness.strategy.status, "blocked");
});

test("market-scoped platform directives never become global Discovery filters", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS.find((item) => item.id === "complex-combined")!.understanding);
  understanding.facts.push(
    { ...understanding.facts[0], id: "egypt-instagram", concept: "platform_directive", value: "Instagram" },
    { ...understanding.facts[1], id: "ksa-tiktok", concept: "platform_directive", value: "TikTok" }
  );
  const context = buildStrategyContext(understanding)!;
  const csr = buildCreatorSearchRequirements({
    strategy: { understanding: { platforms: [] } } as never,
    strategyContext: context,
    now: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(context.platformDirectives.filter((item) => item.basis.scope).length, 2);
  assert.deepEqual(csr.search.platforms, []);
});

test("semantic identity collapses identical directives but retains distinct targets and qualifiers", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS[0].understanding);
  const instagram = { ...understanding.facts[1], id: "instagram", concept: "platform_directive", value: "Instagram" };
  understanding.facts = [understanding.facts[0], instagram, { ...instagram, id: "instagram-duplicate" },
    { ...instagram, id: "tiktok-conditional", value: "TikTok", condition: { operator: "all", clauses: [{ factConcept: "paid_amplification", operator: "selected" }] } },
    { ...instagram, id: "instagram-excluded", concept: "platform_excluded", value: "Instagram" }];
  const context = buildStrategyContext(understanding)!;
  assert.equal(context.platformDirectives.filter((item) => item.platform === "Instagram" && item.priority === "primary").length, 1);
  assert.ok(context.platformDirectives.some((item) => item.platform === "TikTok" && item.priority === "conditional"));
  assert.ok(context.platformDirectives.some((item) => item.platform === "Instagram" && item.priority === "excluded"));
});

test("a blocked Strategy context produces an explicit non-recommendation document", () => {
  const understanding = structuredClone(GOLDEN_BRIEF_CORPUS.find((item) => item.id === "contradictory-requirements")!.understanding);
  const context = buildStrategyContext(understanding)!;
  const strategy = writeStrategyDocumentFromBrief({ rawMessage: "", campaignFacts: { extractedAt: "2026-01-01T00:00:00.000Z", confidence: {}, sources: {} } }, undefined, context);
  assert.equal(strategy.status, "blocked");
  assert.deepEqual(strategy.understanding.platforms, []);
  assert.deepEqual(strategy.creatorTierStrategy, []);
  assert.ok(strategy.narrative.includes("Launch and approval windows conflict."));
});
