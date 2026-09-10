/**
 * The Creator stage told a conversion campaign it was an awareness campaign.
 *
 * "Drive Consideration & Conversion" classified as awareness ONLY: the
 * awareness pattern matched "consider", and the acquisition pattern tested
 * `convert`, which "Conversion" does not contain. The rationale then read
 * "Awareness objective concentrates spend on fewer higher-reach creators"
 * beside a confirmed objective that says the opposite.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import { deriveCreatorQuantityRecommendation, objectiveKindOf } from "./creator-quantity";

function facts(objective: string): CampaignFacts {
  return {
    brandName: "Kérastase",
    industry: "Beauty & Personal Care",
    objective,
    geography: ["Egypt"],
    platforms: ["instagram", "tiktok"],
    budget: { amount: 3_000_000, currency: "EGP" },
    durationWeeks: 4,
    extractedAt: "2026-04-01T00:00:00.000Z",
    confidence: {},
    sources: {},
  };
}

test("the Kérastase objective is awareness AND acquisition, not awareness alone", () => {
  assert.equal(objectiveKindOf("Drive Consideration & Conversion"), "both");
});

test("bottom-funnel wording is recognised", () => {
  for (const objective of [
    "Drive conversions",
    "Increase purchases",
    "Drive qualified traffic and purchase intent",
    "Grow subscriptions",
    "Coupon redemptions",
    "Drive first orders",
  ]) {
    assert.notEqual(objectiveKindOf(objective), "awareness", objective);
    assert.notEqual(objectiveKindOf(objective), "other", objective);
  }
});

test("a genuine awareness brief is still awareness", () => {
  assert.equal(objectiveKindOf("Build brand awareness and reach"), "awareness");
});

test("no rationale line contradicts the confirmed objective", () => {
  const quantity = deriveCreatorQuantityRecommendation(facts("Drive Consideration & Conversion"));

  const text = [quantity.rationale, ...quantity.evidence].join(" ");
  assert.ok(
    !/Awareness objective/i.test(text),
    `stale awareness rationale survived: ${text}`
  );
  assert.match(text, /Drive Consideration & Conversion/, "the rationale quotes the real objective");
  assert.match(text, /both reach and conversion coverage/);
});

test("the rationale changes when the objective changes", () => {
  const awareness = deriveCreatorQuantityRecommendation(facts("Build brand awareness"));
  const conversion = deriveCreatorQuantityRecommendation(
    facts("Drive Consideration & Conversion")
  );

  assert.notEqual(awareness.rationale, conversion.rationale);
  assert.match(awareness.rationale, /Build brand awareness/);
  assert.match(conversion.rationale, /Drive Consideration & Conversion/);
  assert.ok(
    (conversion.recommended ?? 0) > (awareness.recommended ?? 0),
    "a funnel-spanning objective needs conversion coverage as well as reach"
  );
});

test("an objective the classifier cannot place still names itself, never a category", () => {
  const quantity = deriveCreatorQuantityRecommendation(facts("Celebrate the brand's 50th year"));
  const text = [quantity.rationale, ...quantity.evidence].join(" ");
  assert.match(text, /Celebrate the brand's 50th year/);
  assert.ok(!/Awareness objective|Acquisition objective/i.test(text));
});

// ---------------------------------------------------------------------------
// Requested creator quantity is never invented (Part 6 / test 11).

test("a brief with no requested count leaves it undefined and still recommends", () => {
  const base = facts("Drive Consideration & Conversion");
  assert.equal(base.requestedCreatorCount, undefined);

  const quantity = deriveCreatorQuantityRecommendation(base);
  assert.ok(quantity.recommended != null && quantity.recommended > 0);
  assert.ok(
    !quantity.evidence.some((line) => /requested/i.test(line)),
    "nothing may claim the brief requested a quantity"
  );
});

test("a requested count is the target, and a changed one recalculates", () => {
  const base = facts("Drive Consideration & Conversion");
  assert.equal(deriveCreatorQuantityRecommendation({ ...base, requestedCreatorCount: 10 }).recommended, 10);
  assert.equal(deriveCreatorQuantityRecommendation({ ...base, requestedCreatorCount: 12 }).recommended, 12);
  assert.equal(deriveCreatorQuantityRecommendation({ ...base, requestedCreatorCount: 9 }).recommended, 9);
});
