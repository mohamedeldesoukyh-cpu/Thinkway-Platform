/**
 * The alternatives list must show what is actually there.
 *
 * `selectStudioRecommendedVendors` gates the recommendations list on market,
 * the ECI decision and the brief creator mix. Deriving the candidates from that
 * same filtered list silently removed replacement options, so these tests pin
 * that every remaining recommendation is accounted for and that a creator that
 * is genuinely no longer eligible says so instead of disappearing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CANDIDATE_INELIGIBILITY_LABEL,
  candidateIsSelectable,
  classifyReplacementCandidates,
  summarizeCandidates,
} from "./studio-replacement-candidates";

type V = { id: string; market: boolean; eci: boolean; mix: boolean };

function vendor(id: string, overrides?: Partial<V>): V {
  return { id, market: true, eci: true, mix: true, ...overrides };
}

const GATES = {
  matchesMarket: (v: V) => v.market,
  passesEciGate: (v: V) => v.eci,
  fitsBriefMix: (v: V) => v.mix,
};

test("the five remaining recommendations are all listed, not filtered away", () => {
  // The verification campaign: 10 recommended, 5 selected, 5 candidates — and
  // ECI has since judged two of them differently.
  const remaining = [
    vendor("c6"),
    vendor("c7", { eci: false }),
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

test("a creator ECI no longer recommends is flagged, not hidden", () => {
  const classified = classifyReplacementCandidates([vendor("c7", { eci: false })], GATES);

  assert.equal(classified[0].ineligibility, "eci_not_recommended");
  assert.equal(
    CANDIDATE_INELIGIBILITY_LABEL[classified[0].ineligibility!],
    "Campaign recommendation: not recommended",
    "the operator is told why, in client-facing wording — ECI stays internal"
  );
  assert.equal(
    candidateIsSelectable(classified[0]),
    true,
    "an advisory judgement does not remove the operator's option"
  );
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
  // All three gates fail. `selectStudioRecommendedVendors` tests market first,
  // so market is the reason reported — not an arbitrary one.
  const classified = classifyReplacementCandidates(
    [vendor("c12", { market: false, eci: false, mix: false })],
    GATES
  );
  assert.equal(classified[0].ineligibility, "outside_market");

  const eciFirst = classifyReplacementCandidates([vendor("c13", { eci: false, mix: false })], GATES);
  assert.equal(eciFirst[0].ineligibility, "eci_not_recommended");
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
      vendor("c7", { eci: false }),
      vendor("c8"),
      vendor("c9", { mix: false }),
      vendor("c10", { market: false }),
    ],
    GATES
  );

  const summary = summarizeCandidates(classified);
  // c6 and c8 are clean; c7, c9 and c10 each carry a reason, and only c10's
  // reason (market) also withholds selection.
  assert.deepEqual(summary, { total: 5, eligible: 2, flagged: 3, notSelectable: 1 });
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
