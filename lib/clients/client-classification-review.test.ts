import assert from "node:assert/strict";

import {
  computeNeedsReview,
  isReviewConfidence,
  REVIEW_CONFIDENCE_THRESHOLD,
} from "./client-classification-review";

function run() {
  assert.equal(REVIEW_CONFIDENCE_THRESHOLD, 80);

  assert.equal(computeNeedsReview(79, "rule"), true);
  assert.equal(computeNeedsReview(80, "rule"), false);
  assert.equal(computeNeedsReview(95, "rule"), false);

  assert.equal(computeNeedsReview(95, "ai_search"), true);
  assert.equal(computeNeedsReview(100, "ai_search"), true);

  assert.equal(computeNeedsReview(100, "approved"), false);
  assert.equal(computeNeedsReview(100, "historical"), false);
  assert.equal(computeNeedsReview(100, "fallback"), false);

  assert.equal(isReviewConfidence(79), true);
  assert.equal(isReviewConfidence(80), false);

  console.log("client-classification-review.test.ts: ok");
}

run();
