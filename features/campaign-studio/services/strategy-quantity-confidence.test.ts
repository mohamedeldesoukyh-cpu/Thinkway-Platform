/**
 * What the Strategy screen's quantity confidence actually measures.
 *
 * It is a three-step lookup on how many of duration, budget and objective are
 * confirmed — 3 → 86%, 2 → 64%, otherwise 42%, and exactly 100% when the brief
 * or the operator states a quantity outright. It is not creator quality, not
 * creator fit, not the chance of finding creators, and no creator score,
 * relevance score, ECI score or platform signal enters it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import { deriveCreatorQuantityRecommendation } from "./creator-quantity";

const NOW = "2026-04-01T00:00:00.000Z";

function facts(overrides: Partial<CampaignFacts> = {}): CampaignFacts {
  return {
    brandName: "Kérastase",
    industry: "Beauty & Personal Care",
    objective: "Drive Consideration & Conversion",
    geography: ["Egypt"],
    platforms: ["instagram", "tiktok"],
    budget: { amount: 3_000_000, currency: "EGP" },
    durationWeeks: 4,
    extractedAt: NOW,
    confidence: {},
    sources: {},
    ...overrides,
  };
}

test("all three evidence facts confirmed is the 86% the screen shows", () => {
  assert.equal(deriveCreatorQuantityRecommendation(facts()).confidence, 0.86);
});

test("each missing evidence fact lowers it, by that count alone", () => {
  assert.equal(
    deriveCreatorQuantityRecommendation(facts({ budget: undefined })).confidence,
    0.64,
    "two of three"
  );
  assert.equal(
    deriveCreatorQuantityRecommendation(
      facts({ budget: undefined, durationWeeks: undefined })
    ).confidence,
    0.42,
    "one of three"
  );
});

test("a stated quantity is a decision, so confidence is total", () => {
  const quantity = deriveCreatorQuantityRecommendation(facts({ requestedCreatorCount: 10 }));
  assert.equal(quantity.confidence, 1);
  assert.equal(quantity.recommended, 10);
});

test("confidence does not move with creator quality, fit or inventory quality", () => {
  const base = deriveCreatorQuantityRecommendation(facts()).confidence;

  // A pool that exists at all, and a pool large enough — same confidence: the
  // number is about the campaign evidence, not about the creators found.
  assert.equal(deriveCreatorQuantityRecommendation(facts(), { poolSize: 50 }).confidence, base);
  assert.equal(deriveCreatorQuantityRecommendation(facts(), { poolSize: 3 }).confidence, base);
});

test("an inventory-capped quantity says so in its own evidence", () => {
  // The confidence stays 86% because the campaign evidence is unchanged — the
  // cap is reported as evidence instead, so the two are not conflated.
  const capped = deriveCreatorQuantityRecommendation(facts(), { poolSize: 3 });
  assert.equal(capped.recommended, 3);
  assert.equal(capped.confidence, 0.86);
  assert.ok(
    capped.evidence.some((line) => /capped to available pool/i.test(line)),
    `expected the cap in evidence, got ${JSON.stringify(capped.evidence)}`
  );
});

test("no evidence at all yields no quantity, not a low-confidence guess", () => {
  const quantity = deriveCreatorQuantityRecommendation({
    extractedAt: NOW,
    confidence: {},
    sources: {},
  });
  assert.equal(quantity.recommended, null);
  assert.equal(quantity.confidence, 0);
  assert.deepEqual(quantity.evidence, []);
});

test("the tier mix does not change the confidence", () => {
  const briefTiers = deriveCreatorQuantityRecommendation(
    facts({ creatorTiers: [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }] })
  );
  assert.equal(briefTiers.confidence, deriveCreatorQuantityRecommendation(facts()).confidence);
});

test("platform count changes the quantity but never the confidence", () => {
  const twoPlatforms = deriveCreatorQuantityRecommendation(facts());
  const fourPlatforms = deriveCreatorQuantityRecommendation(
    facts({ platforms: ["instagram", "tiktok", "youtube", "snapchat"] })
  );

  assert.equal(fourPlatforms.confidence, twoPlatforms.confidence);
  assert.ok(
    (fourPlatforms.recommended ?? 0) > (twoPlatforms.recommended ?? 0),
    "more platforms need more creators — a coverage rule, not a confidence one"
  );
});
