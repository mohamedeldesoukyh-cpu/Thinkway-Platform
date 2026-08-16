import assert from "node:assert/strict";
import { test } from "node:test";

import {
  selectStudioRecommendedVendors,
  vendorPassesStudioRecommendationGate,
} from "./studio-recommended-vendors";

test("blank or unknown home country is not treated as in-market", () => {
  const selected = selectStudioRecommendedVendors(
    [
      { id: "eg", country: "Egypt", recommendation: "Recommended" },
      { id: "blank", country: undefined, recommendation: "Recommended" },
      { id: "uae", country: "United Arab Emirates", recommendation: "Recommended" },
    ],
    {
      markets: ["Egypt"],
      locationOf: (vendor) => ({ country: vendor.country }),
      recommendationOf: (vendor) => vendor.recommendation,
    }
  );
  assert.deepEqual(
    selected.map((vendor) => vendor.id),
    ["eg"]
  );
});

test("ECI Not Recommended / High Risk / Insufficient Data are excluded from the recommended list", () => {
  assert.equal(vendorPassesStudioRecommendationGate(undefined), true);
  assert.equal(vendorPassesStudioRecommendationGate("Recommended"), true);
  assert.equal(vendorPassesStudioRecommendationGate("Consider"), true);
  assert.equal(vendorPassesStudioRecommendationGate("Not Recommended"), false);
  assert.equal(vendorPassesStudioRecommendationGate("High Risk"), false);
  assert.equal(vendorPassesStudioRecommendationGate("Insufficient Data"), false);

  const selected = selectStudioRecommendedVendors(
    [
      { id: "yes", country: "Egypt", recommendation: "Recommended" },
      { id: "no", country: "Egypt", recommendation: "High Risk" },
      { id: "pending", country: "Egypt", recommendation: undefined },
    ],
    {
      markets: ["Egypt"],
      locationOf: (vendor) => ({ country: vendor.country }),
      recommendationOf: (vendor) => vendor.recommendation,
    }
  );
  assert.deepEqual(
    selected.map((vendor) => vendor.id),
    ["yes", "pending"]
  );
});

test("off-brief Beauty/Fashion/Fitness specialists are dropped from the recommended list", () => {
  const selected = selectStudioRecommendedVendors(
    [
      { id: "sport", country: "Egypt", recommendation: "Recommended", mix: true },
      { id: "abeer", country: "Egypt", recommendation: "Recommended", mix: false },
    ],
    {
      markets: ["Egypt"],
      locationOf: (vendor) => ({ country: vendor.country }),
      recommendationOf: (vendor) => vendor.recommendation,
      fitsBriefMix: (vendor) => vendor.mix,
    }
  );
  assert.deepEqual(
    selected.map((vendor) => vendor.id),
    ["sport"]
  );
});
