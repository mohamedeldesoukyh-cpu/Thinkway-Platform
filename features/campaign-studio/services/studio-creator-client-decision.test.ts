/**
 * Internal analyst reasoning was being printed on the client-facing creator
 * card: "Enterprise Creator Intelligence", "Overall score 40 with multiple
 * high risks", "Commercial outlook weak", "Evidence does not support
 * selection", a bare confidence percentage. None of it was wrong — it is
 * decision-support language, and the card is not where it belongs.
 *
 * Nothing here changes an ECI calculation, a score or a gate. These tests pin
 * the presentation boundary: what a card may say, and that a card's decision is
 * stated in the vocabulary of the group it sits in, so a heading and a card can
 * never contradict each other.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StudioEciPlanningSignal } from "./eci/project-studio-eci-signal";
import {
  INTERNAL_TERMINOLOGY,
  containsInternalTerminology,
  studioClientDecision,
} from "./studio-creator-client-decision";

function signal(overrides: Partial<StudioEciPlanningSignal> = {}): StudioEciPlanningSignal {
  return {
    influencerId: "inf:c1",
    platform: "instagram",
    investmentScore: 62,
    recommendation: "Recommended",
    why: "Category-aligned audience in the campaign market.",
    whyNot: "No critical blockers identified.",
    businessObjectiveSupport: "Supports the awareness objective on Instagram.",
    commercialJustification: "Rates are within the campaign band.",
    commercialHealth: "Moderate",
    businessReadiness: "Ready",
    evidence: [],
    topStrengths: ["Strong category specialisation for haircare."],
    risks: [],
    alternatives: [],
    expectedOutcomes: [],
    confidencePercent: 62,
    evidenceCoveragePercent: 55,
    executiveSummary: "Recommended",
    layers: {
      investment: "",
      commercial: "",
      audience: "",
      performance: "",
      categoryBrand: "",
      historical: "",
    },
    decision: {
      what: "Recommended for this campaign",
      why: "Category-aligned audience.",
      evidence: "",
      businessValue: "",
      alternative: "",
      whyNot: "",
    },
    expectedCampaignContribution: "Adds category-aligned reach.",
    ...overrides,
  };
}

/** The exact strings the screenshots showed on client-facing cards. */
const LEAKED_LINES = [
  "Enterprise Creator Intelligence recommends holding this creator.",
  "Overall score 40 with multiple high risks.",
  "Investment signals are weak for this creator.",
  "Commercial outlook weak for the campaign window.",
  "Evidence does not support selection at this budget.",
  "Evidence coverage 35% across the investment layers.",
  "Internal decision layers disagree on this creator.",
  "Risk classification places this creator in the high band.",
  "Confidence: 40%",
  "Investment score 40/100 for this campaign.",
];

test("every leaked line from the screenshots is recognised as internal", () => {
  for (const line of LEAKED_LINES) {
    assert.equal(containsInternalTerminology(line), true, line);
  }
});

test("ordinary business language is not mistaken for internal terminology", () => {
  for (const line of [
    "Category-aligned audience in the campaign market.",
    "Meets 4 of 5 campaign requirements.",
    "Strong category specialisation for haircare.",
    "Supports the awareness objective on Instagram.",
    "Available from Discovery as a replacement for this campaign.",
  ]) {
    assert.equal(containsInternalTerminology(line), false, line);
  }
});

test("no internal terminology survives onto a card, in any group", () => {
  const leaky = signal({
    why: LEAKED_LINES[1],
    whyNot: LEAKED_LINES[4],
    risks: [LEAKED_LINES[3], LEAKED_LINES[7]],
    topStrengths: [LEAKED_LINES[2]],
    businessObjectiveSupport: LEAKED_LINES[0],
    recommendation: "Not Recommended",
  });

  for (const group of ["selected", "needs_review", "alternatives"] as const) {
    const decision = studioClientDecision({ group, signal: leaky });
    const text = [decision.label, ...decision.reasons].join(" ");
    for (const pattern of INTERNAL_TERMINOLOGY) {
      assert.equal(pattern.test(text), false, `${group}: ${pattern} matched ${JSON.stringify(text)}`);
    }
    assert.ok(decision.reasons.length > 0, `${group} still says something`);
  }
});

test("a card never shows a raw confidence or score number", () => {
  const decision = studioClientDecision({
    group: "selected",
    signal: signal({ why: "Confidence: 62% and score 62/100 support this creator." }),
  });
  const text = [decision.label, ...decision.reasons].join(" ");
  assert.doesNotMatch(text, /\d+\s*%/);
  assert.doesNotMatch(text, /\d+\s*\/\s*100/);
});

// ---------------------------------------------------------------------------
// The group decides the vocabulary, so a heading cannot contradict a card.

test("the recommended group says recommended", () => {
  const decision = studioClientDecision({ group: "selected", signal: signal() });
  assert.equal(decision.label, "Recommended for this campaign");
  assert.equal(decision.tone, "positive");
});

test("a Discovery alternative is not presented as a recommendation", () => {
  const decision = studioClientDecision({ group: "alternatives", signal: signal() });
  assert.equal(decision.label, "Discovery alternative");
  assert.equal(decision.tone, "neutral");
  assert.doesNotMatch(decision.label, /^Recommended/);
});

test("a rejected creator is never labelled recommended, in any group", () => {
  const rejected = signal({ recommendation: "Not Recommended", whyNot: "Audience sits outside the campaign market." });
  assert.equal(
    studioClientDecision({ group: "alternatives", signal: rejected }).label,
    "Not recommended for this campaign"
  );
  assert.equal(
    studioClientDecision({ group: "needs_review", signal: rejected }).label,
    "On the slate · not recommended for this campaign"
  );
  // Even in the selected group the card tells the truth — the partition is what
  // must keep such a creator out of that group, not a relabelling.
  assert.equal(
    studioClientDecision({ group: "selected", signal: rejected }).tone,
    "negative"
  );
});

test("a slate member held by the gate claims neither verdict", () => {
  // The gate rejects for reasons ECI knows nothing about — out of market, off
  // the brief's tier mix. Such a creator is not recommended and not rejected.
  const decision = studioClientDecision({ group: "needs_review", signal: signal() });
  assert.equal(decision.label, "On the slate · needs review");
  assert.equal(decision.tone, "neutral");
  assert.doesNotMatch(decision.label, /^Recommended/);
  assert.doesNotMatch(decision.label, /not recommended/i);
});

test("\"Consider\" is a cautious yes, not a rejection", () => {
  const decision = studioClientDecision({
    group: "selected",
    signal: signal({ recommendation: "Consider" }),
  });
  assert.equal(decision.label, "Recommended for this campaign");
  assert.notEqual(decision.tone, "negative");
});

test("no signal is absent intelligence, never a rejection", () => {
  for (const group of ["selected", "needs_review", "alternatives"] as const) {
    const decision = studioClientDecision({ group, signal: null });
    assert.notEqual(decision.tone, "negative", group);
    assert.doesNotMatch(decision.label, /not recommended/i, group);
    assert.ok(decision.reasons.length > 0, group);
  }
});

test("requirement coverage is stated as met-of-total, not as a score", () => {
  const partial = studioClientDecision({
    group: "selected",
    signal: signal({ topStrengths: [], why: "", businessObjectiveSupport: "" }),
    requirementsMet: { met: 4, total: 6 },
  });
  assert.ok(
    partial.reasons.includes("Meets 4 of 6 campaign requirements."),
    JSON.stringify(partial.reasons)
  );

  const full = studioClientDecision({
    group: "selected",
    signal: signal({ topStrengths: [], why: "", businessObjectiveSupport: "" }),
    requirementsMet: { met: 6, total: 6 },
  });
  assert.ok(full.reasons.includes("Meets every campaign requirement."));
});

test("reasons are deduplicated and bounded", () => {
  const repeated = signal({
    topStrengths: ["Strong category fit.", "Strong category fit.", "Audience in market."],
    why: "Strong category fit.",
    businessObjectiveSupport: "Supports the awareness objective.",
  });
  const decision = studioClientDecision({ group: "selected", signal: repeated, reasonLimit: 3 });
  assert.ok(decision.reasons.length <= 3);
  assert.equal(new Set(decision.reasons).size, decision.reasons.length);
});
