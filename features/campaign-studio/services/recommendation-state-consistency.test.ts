/**
 * Group membership and per-card recommendation state must tell one story.
 *
 * Observed contradiction: a creator sat under the heading "Other Recommended
 * Creators" while its own card showed the ECI campaign decision "Not
 * Recommended" with a reason. Two different systems produced those states and
 * both were correct:
 *
 *   - membership came from `splitRecommendedCreatorIds`, whose remainder is
 *     Discovery's searched pool minus the slate — it asserts nothing about any
 *     recommendation;
 *   - the pill came from the ECI planning signal via
 *     `toCampaignDecisionLabel(signal.recommendation)`.
 *
 * The heading was the only untruth. Groups now carry their meaning, and these
 * tests pin that a slate group can never hold a rejected creator and that a
 * non-slate group can never claim a recommendation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { toCampaignDecisionLabel } from "./eci/strategy-confidence";
import { selectStudioRecommendedVendors, vendorPassesStudioRecommendationGate } from "./studio-recommended-vendors";
import { creatorGroupingKey, splitRecommendedCreatorIds } from "./studio-creator-slate-split";
import {
  classifyReplacementCandidates,
  studioCreatorGroupConflicts,
  type StudioCreatorGroup,
} from "./studio-replacement-candidates";

type Vendor = {
  id: string;
  displayName: string;
  country: string;
  /** The ECI recommendation string, as the planning signal carries it. */
  eciRecommendation?: string;
};

/** What the card renders: the ECI decision label. */
function cardDecision(vendor: Vendor): string {
  return vendor.eciRecommendation
    ? toCampaignDecisionLabel(vendor.eciRecommendation)
    : "Recommended";
}

function isNotRecommended(vendor: Vendor): boolean {
  return cardDecision(vendor) === "Not Recommended";
}

/** The hydrated pool: five selected, five more from Discovery. */
const POOL: Vendor[] = [
  { id: "inf:a", displayName: "Creator A", country: "Egypt", eciRecommendation: "Recommended" },
  { id: "inf:b", displayName: "Creator B", country: "Egypt", eciRecommendation: "Consider" },
  { id: "inf:c", displayName: "Creator C", country: "Egypt" },
  { id: "inf:d", displayName: "Creator D", country: "Egypt", eciRecommendation: "Recommended" },
  { id: "inf:e", displayName: "Creator E", country: "Egypt", eciRecommendation: "Recommended" },
  { id: "inf:f", displayName: "Creator F", country: "Egypt", eciRecommendation: "Recommended" },
  { id: "inf:g", displayName: "Creator G", country: "Egypt", eciRecommendation: "High risk — avoid" },
  { id: "inf:h", displayName: "Creator H", country: "Egypt", eciRecommendation: "Not recommended" },
  { id: "inf:i", displayName: "Creator I", country: "Egypt", eciRecommendation: "Insufficient evidence" },
  { id: "inf:j", displayName: "Creator J", country: "Egypt", eciRecommendation: "Recommended" },
];

const SLATE = ["inf:a", "inf:b", "inf:c", "inf:d", "inf:e"];

/** The section's grouping, built from the same helpers the component uses. */
function buildGroups(slate: string[]): Array<StudioCreatorGroup<Vendor>> {
  const gated = selectStudioRecommendedVendors(POOL, {
    markets: ["Egypt"],
    locationOf: (vendor) => ({ country: vendor.country, countryCode: null }),
    recommendationOf: (vendor) => vendor.eciRecommendation,
  });

  const split = splitRecommendedCreatorIds({
    recommendationIds: slate,
    discoveryIds: POOL.map((vendor) => vendor.id),
  });
  const selectedKeys = new Set(split.selectedIds.map(creatorGroupingKey));

  const selected = gated.filter((vendor) => selectedKeys.has(creatorGroupingKey(vendor.id)));
  const remaining = POOL.filter((vendor) => !selectedKeys.has(creatorGroupingKey(vendor.id)));
  const classified = classifyReplacementCandidates(remaining, {
    matchesMarket: (vendor) => vendor.country === "Egypt",
    passesEciGate: (vendor) => vendorPassesStudioRecommendationGate(vendor.eciRecommendation),
    fitsBriefMix: () => true,
  });

  return [
    { kind: "selected", title: null, items: selected },
    {
      kind: "alternatives",
      title: `Other creators from Discovery (${classified.length})`,
      items: classified.map((candidate) => candidate.vendor),
    },
  ];
}

const READ = { isNotRecommended, creatorIdOf: (vendor: Vendor) => vendor.id };

// ---------------------------------------------------------------------------
// The invariant, on the real grouping.

test("the section's own grouping has no recommendation contradiction", () => {
  const conflicts = studioCreatorGroupConflicts(buildGroups(SLATE), READ);
  assert.deepEqual(conflicts, [], `contradictions: ${JSON.stringify(conflicts, null, 2)}`);
});

test("a creator the ECI rejects never reaches the selected group", () => {
  // The rejected creators are in the pool and two of them are even named in the
  // slate ids — the gate is what keeps them out of the selected group.
  const groups = buildGroups([...SLATE, "inf:g", "inf:h"]);
  const selected = groups.find((group) => group.kind === "selected")!;

  assert.ok(
    !selected.items.some(isNotRecommended),
    `selected group holds a rejected creator: ${selected.items
      .filter(isNotRecommended)
      .map((vendor) => vendor.id)
      .join(", ")}`
  );
  assert.deepEqual(studioCreatorGroupConflicts(groups, READ), []);
});

test("the alternatives group may hold rejected creators — it claims nothing", () => {
  const groups = buildGroups(SLATE);
  const alternatives = groups.find((group) => group.kind === "alternatives")!;

  assert.ok(
    alternatives.items.some(isNotRecommended),
    "this fixture must exercise the case that produced the contradiction"
  );
  assert.deepEqual(studioCreatorGroupConflicts(groups, READ), []);
});

test("no non-slate heading claims a recommendation", () => {
  for (const group of buildGroups(SLATE)) {
    if (group.kind === "selected") continue;
    assert.ok(
      !/recommend/i.test(group.title ?? ""),
      `"${group.title}" claims a recommendation for creators whose cards state their own decision`
    );
  }
});

// ---------------------------------------------------------------------------
// The invariant actually catches a contradiction (non-vacuous).

test("a rejected creator placed in a selected group is reported", () => {
  const conflicts = studioCreatorGroupConflicts(
    [{ kind: "selected", title: "Main picks", items: [POOL[7]!] }],
    READ
  );

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]!.reason, "not_recommended_in_selected_group");
  assert.equal(conflicts[0]!.creatorId, "inf:h");
});

test("the old heading is reported as a contradiction", () => {
  // The exact regression: this heading over Discovery's pool.
  const conflicts = studioCreatorGroupConflicts(
    [
      {
        kind: "alternatives",
        title: "Other Recommended Creators (5)",
        items: [POOL[7]!],
      },
    ],
    READ
  );

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0]!.reason, "recommendation_claimed_in_title");
});

// ---------------------------------------------------------------------------
// The two systems stay separate and keep their own meanings.

test("a cautious ECI decision is a recommendation, and stays selectable", () => {
  // "Consider" is a cautious yes — documented in `toCampaignDecisionLabel`.
  assert.equal(toCampaignDecisionLabel("Consider"), "Recommended");
  assert.equal(vendorPassesStudioRecommendationGate("Consider"), true);
});

test("a creator with no ECI signal yet is not treated as rejected", () => {
  // Pending hydration must not read as a negative decision.
  assert.equal(vendorPassesStudioRecommendationGate(undefined), true);
  assert.equal(isNotRecommended(POOL[2]!), false);
});

test("every negative ECI phrasing the projection uses is caught", () => {
  for (const recommendation of [
    "Not recommended",
    "High risk — avoid",
    "Insufficient evidence",
  ]) {
    assert.equal(
      toCampaignDecisionLabel(recommendation),
      "Not Recommended",
      recommendation
    );
    assert.equal(vendorPassesStudioRecommendationGate(recommendation), false, recommendation);
  }
});
