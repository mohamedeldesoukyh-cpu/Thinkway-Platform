import assert from "node:assert/strict";
import test from "node:test";

import { coerceLlmExtractionJson } from "./extract-profile-llm";

test("coerces brand + numeric budget + market into schema-compatible shape", () => {
  const coerced = coerceLlmExtractionJson(
    {
      brand: "Formula 1",
      market: "United Arab Emirates",
      budget: 900000,
      platforms: ["instagram", "tiktok"],
      creatorCategories: ["sports", "lifestyle"],
      fieldConfidence: { brand: 1, market: 1, budget: 1 },
    },
    "Brand Formula 1, market United Arab Emirates, budget 900000 AED"
  ) as Record<string, unknown>;

  assert.equal(coerced.brandName, "Formula 1");
  assert.deepEqual(coerced.budget, { amount: 900000, currency: "AED" });
  assert.deepEqual(coerced.geography, ["United Arab Emirates"]);
  assert.equal((coerced.fieldConfidence as Record<string, number>).brandName, 1);
});
