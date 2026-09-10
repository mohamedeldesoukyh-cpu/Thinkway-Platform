/**
 * What belongs on the campaign's recommendation list.
 *
 * The gate once also required a positive ECI INVESTMENT verdict
 * (`toCampaignDecisionLabel(signal.recommendation) === "Recommended"`), so an
 * investment reading decided campaign membership: a creator meeting every
 * requirement the brief stated dropped off the campaign's own recommendation
 * for a thin commercial record, and "Insufficient Data" was treated as a
 * rejection. The gate is now the campaign's own requirements — its market and
 * the brief's creator mix — and the creator's campaign decision comes from
 * `resolveCampaignCreatorDecision`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCampaignCreatorDecision } from "./studio-campaign-creator-decision";
import { selectStudioRecommendedVendors } from "./studio-recommended-vendors";

test("blank or unknown home country is not treated as in-market", () => {
  const selected = selectStudioRecommendedVendors(
    [
      { id: "eg", country: "Egypt" },
      { id: "blank", country: undefined },
      { id: "uae", country: "United Arab Emirates" },
    ],
    {
      markets: ["Egypt"],
      locationOf: (vendor) => ({ country: vendor.country }),
    }
  );
  assert.deepEqual(
    selected.map((vendor) => vendor.id),
    ["eg"]
  );
});

test("an investment verdict no longer removes a creator from the recommendation", () => {
  // Updated deliberately — this test used to require exactly that.
  const selected = selectStudioRecommendedVendors(
    [
      { id: "yes", country: "Egypt" },
      { id: "thin-record", country: "Egypt" },
      { id: "pending", country: "Egypt" },
    ],
    {
      markets: ["Egypt"],
      locationOf: (vendor) => ({ country: vendor.country }),
    }
  );
  assert.deepEqual(
    selected.map((vendor) => vendor.id),
    ["yes", "thin-record", "pending"],
    "every in-market creator stays; the card states each one's campaign decision"
  );
});

test("insufficient investment data is not a campaign rejection", () => {
  const decision = resolveCampaignCreatorDecision({
    onSlate: true,
    requirements: [
      { label: "Market", met: true },
      { label: "Creator mix", met: true },
    ],
    supportingSignal: null,
  });
  assert.equal(decision.status, "recommended");
});

test("off-brief Beauty/Fashion/Fitness specialists are dropped from the recommended list", () => {
  const selected = selectStudioRecommendedVendors(
    [
      { id: "sport", country: "Egypt", mix: true },
      { id: "abeer", country: "Egypt", mix: false },
    ],
    {
      markets: ["Egypt"],
      locationOf: (vendor) => ({ country: vendor.country }),
      fitsBriefMix: (vendor) => vendor.mix,
    }
  );
  assert.deepEqual(
    selected.map((vendor) => vendor.id),
    ["sport"]
  );
});

test("the gate reads only requirements the campaign stated", () => {
  // No market stated: nothing is excluded for being out of it.
  const selected = selectStudioRecommendedVendors(
    [
      { id: "eg", country: "Egypt" },
      { id: "fr", country: "France" },
    ],
    { markets: [], locationOf: (vendor) => ({ country: vendor.country }) }
  );
  assert.deepEqual(
    selected.map((vendor) => vendor.id),
    ["eg", "fr"]
  );
});
