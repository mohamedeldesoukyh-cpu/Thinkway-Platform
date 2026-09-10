/**
 * The alternatives list must show what is actually there.
 *
 * `selectStudioRecommendedVendors` gates the recommendations list on the
 * campaign's own requirements: market and the brief's creator mix. (It once
 * also required a positive ECI INVESTMENT verdict — that conflation is gone,
 * along with the `eci_not_recommended` reason it produced.) Deriving the
 * candidates from that same filtered list silently removed replacement
 * options, so these tests pin that every remaining recommendation is accounted
 * for and that a creator that is genuinely no longer eligible says so instead
 * of disappearing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDIDATE_INELIGIBILITY_LABEL,
  candidateIsSelectable,
  classifyReplacementCandidates,
  summarizeCandidates,
} from "./studio-replacement-candidates";

type V = { id: string; market: boolean; mix: boolean };

function vendor(id: string, overrides?: Partial<V>): V {
  return { id, market: true, mix: true, ...overrides };
}

const GATES = {
  matchesMarket: (v: V) => v.market,
  fitsBriefMix: (v: V) => v.mix,
};

test("the five remaining recommendations are all listed, not filtered away", () => {
  // The verification campaign: 10 recommended, 5 selected, 5 candidates — and
  // one of them no longer fits the brief's creator mix.
  const remaining = [
    vendor("c6"),
    vendor("c7"),
    vendor("c8"),
    vendor("c9", { mix: false }),
    vendor("c10"),
  ];

  const classified = classifyReplacementCandidates(remaining, GATES);

  assert.equal(classified.length, 5, "every remaining recommendation is present");
  assert.deepEqual(
    classified.map((candidate) => candidate.vendor.id),
    ["c6", "c7", "c8", "c9", "c10"],
    "pool order is preserved"
  );
  assert.equal(summarizeCandidates(classified).total, 5);
});

test("an investment verdict is no longer an eligibility reason", () => {
  // Updated deliberately. `eci_not_recommended` was labelled "Campaign
  // recommendation: not recommended" — an ECI INVESTMENT verdict presented as
  // the campaign's answer. Investment intelligence no longer gates campaign
  // membership, so the reason class does not exist; the two that remain are
  // requirements the campaign itself stated.
  assert.deepEqual(Object.keys(CANDIDATE_INELIGIBILITY_LABEL), [
    "outside_market",
    "off_brief_mix",
  ]);
  for (const label of Object.values(CANDIDATE_INELIGIBILITY_LABEL)) {
    assert.doesNotMatch(label, /campaign recommendation/i, label);
  }
});

test("an off-brief-mix creator is flagged and still selectable", () => {
  const classified = classifyReplacementCandidates([vendor("c9", { mix: false })], GATES);

  assert.equal(classified[0].ineligibility, "off_brief_mix");
  assert.equal(candidateIsSelectable(classified[0]), true);
});

test("market is a campaign rule: stated, and not offered", () => {
  const classified = classifyReplacementCandidates([vendor("c11", { market: false })], GATES);

  assert.equal(classified[0].ineligibility, "outside_market");
  assert.equal(
    candidateIsSelectable(classified[0]),
    false,
    "the campaign's own geography is not an advisory signal"
  );
});

test("the stated reason is the one that would have removed the creator", () => {
  // Both gates fail. `selectStudioRecommendedVendors` tests market first, so
  // market is the reason reported — not an arbitrary one.
  const classified = classifyReplacementCandidates(
    [vendor("c12", { market: false, mix: false })],
    GATES
  );
  assert.equal(classified[0].ineligibility, "outside_market");

  const mixOnly = classifyReplacementCandidates([vendor("c13", { mix: false })], GATES);
  assert.equal(mixOnly[0].ineligibility, "off_brief_mix");
});

test("a fully eligible candidate carries no reason at all", () => {
  const classified = classifyReplacementCandidates([vendor("c6")], GATES);

  assert.equal(classified[0].ineligibility, undefined);
  assert.equal(candidateIsSelectable(classified[0]), true);
});

test("the summary accounts for every candidate, so no count silently shrinks", () => {
  const classified = classifyReplacementCandidates(
    [
      vendor("c6"),
      vendor("c7"),
      vendor("c8"),
      vendor("c9", { mix: false }),
      vendor("c10", { market: false }),
    ],
    GATES
  );

  const summary = summarizeCandidates(classified);
  // c6, c7 and c8 are clean; c9 and c10 each carry a reason, and only c10's
  // reason (market) also withholds selection.
  assert.deepEqual(summary, { total: 5, eligible: 3, flagged: 2, notSelectable: 1 });
  assert.equal(
    summary.eligible + summary.flagged,
    summary.total,
    "the total is the whole remaining pool, never the gated subset"
  );
});

test("an empty remaining pool classifies to nothing rather than throwing", () => {
  const classified = classifyReplacementCandidates([] as V[], GATES);
  assert.deepEqual(classified, []);
  assert.deepEqual(summarizeCandidates(classified), {
    total: 0,
    eligible: 0,
    flagged: 0,
    notSelectable: 0,
  });
});
