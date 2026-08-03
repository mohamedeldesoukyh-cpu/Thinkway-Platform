import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveExecutiveSummary,
  evidenceAwareGroundingConfidence,
} from "./presentation-intelligence";

test("evidenceAwareGroundingConfidence never exceeds slate fit evidence", () => {
  assert.equal(evidenceAwareGroundingConfidence(46, 91), 51);
  assert.equal(evidenceAwareGroundingConfidence(76, 91), 81);
  assert.equal(evidenceAwareGroundingConfidence(null, 91), 75);
});

test("deriveExecutiveSummary confidence tracks avgFit when provided", () => {
  const summary = deriveExecutiveSummary(
    "Beauty strategy for Egypt",
    "Women 18-35",
    "L'Oréal Paris brand awareness",
    { avgFitScore: 77 }
  );
  assert.equal(summary.grounding?.confidence, 82);
  assert.match(summary.grounding?.reason ?? "", /avg campaign fit 77/);
});
