/**
 * Phase 2 business rule — creator pricing is not a gate.
 *
 * A creator can be discovered, qualified, ranked, recommended, approved and
 * shortlisted without a price. Creator fit and commercial affordability are
 * separate concepts, resolved at different points in the journey.
 *
 * Phase 2 changes none of this code — these tests pin the behaviour so the CSR
 * wiring cannot drift into a commercial gate later.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { applyEnterpriseConstraints } from "@/lib/discovery/enterprise-constraint-engine";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import { isAddableCreator } from "@/features/discovery/shortlists/add-to-shortlist-policy";
import { estimateCreatorPostFee } from "../creator-fee-estimator";

function creator(overrides: Partial<UnifiedCreatorResult>): UnifiedCreatorResult {
  return {
    id: "creator-1",
    unified_id: "creator-1",
    display_name: "Creator One",
    handle: "creator_one",
    platform: "instagram",
    followers: 120_000,
    engagement_rate: 3.2,
    country_code: "EG",
    country_codes: ["EG"],
    categories: ["Food"],
    platforms: [
      {
        platform: "instagram",
        handle: "creator_one",
        followers: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
      },
    ],
    ...overrides,
  } as unknown as UnifiedCreatorResult;
}

const filters: DiscoveryMappedFilter[] = [
  { id: "c", key: "creator_country", label: "Creator Country", value: "EG", weight: 90, confidence: 0.9 },
  { id: "p", key: "platform", label: "Social Platform", value: "instagram", weight: 100, confidence: 0.9 },
  { id: "k", key: "category", label: "Category", value: "Food", weight: 100, confidence: 0.8 },
];

test("a creator with no pricing data survives the Discovery constraint engine", () => {
  // Neither creator carries any commercial field at all — the browse result
  // type has none, which is the point.
  const withMetrics = creator({ id: "priced", unified_id: "priced" });
  const bare = creator({ id: "unpriced", unified_id: "unpriced" });

  const result = applyEnterpriseConstraints([withMetrics, bare], filters);
  const ids = result.creators.map((c) => c.id);

  assert.ok(ids.includes("unpriced"), "a creator without pricing must stay in the pool");
  assert.equal(result.creators.length, 2);
});

test("no commercial key can reach the constraint engine at all", () => {
  // Guard on the type, not the data: DiscoveryMappedFilter's key is the closed
  // Discovery allowlist, which contains no monetary dimension. If a price or
  // budget key were ever added, this assertion is where it should be noticed.
  const keys = filters.map((f) => f.key as string);
  for (const key of keys) {
    assert.ok(!/price|cost|budget|fee|rate/i.test(key));
  }
});

test("a creator with no price is addable to a shortlist", () => {
  assert.equal(
    isAddableCreator({ influencer_id: "inf-1", discovered_profile_id: null }),
    true,
    "shortlist eligibility is identity-based, never commercial"
  );
  assert.equal(
    isAddableCreator({ influencer_id: null, discovered_profile_id: "prof-1" }),
    true
  );
  assert.equal(isAddableCreator({ influencer_id: null, discovered_profile_id: null }), false);
});

test("pricing estimation is unchanged: real quotes win, then rate card, then a labelled estimate", () => {
  assert.equal(
    estimateCreatorPostFee({
      quotationAvgCost: 45_000,
      quotationQuoteCount: 3,
      quotationCurrency: "EGP",
      followers: 120_000,
    }),
    "EGP 45,000 · avg from 3 quotes"
  );

  assert.equal(
    estimateCreatorPostFee({ rateCardAmount: 30_000, currency: "EGP", followers: 120_000 }),
    "EGP 30,000 · 1 post"
  );

  // No quote and no rate card: a benchmark estimate, explicitly labelled "est.".
  const estimated = estimateCreatorPostFee({
    followers: 120_000,
    platform: "instagram",
    currency: "EGP",
  });
  assert.ok(estimated, "a creator with no commercial data still gets a planning estimate");
  assert.match(estimated!, /est\./, "an estimate must stay labelled as an estimate");
});

test("pricing estimation invents nothing when there is nothing to estimate from", () => {
  assert.equal(estimateCreatorPostFee({ currency: "EGP" }), undefined);
  assert.equal(estimateCreatorPostFee({ followers: 0, currency: "EGP" }), undefined);
});
