import assert from "node:assert/strict";
import { test } from "node:test";

import { assertScheduleMoveAllowedByAssignmentGrain } from "./grain-lock-guards";
import type { MediaPlanPerformanceFact } from "./types";

const baseFact: MediaPlanPerformanceFact = {
  creatorId: "mirna",
  creatorName: "mirnasmadness",
  platform: "TikTok",
  deliverable: "TikTok video",
  liveDate: null,
  completed: false,
  campaignLineId: "line-1",
};

test("commercial lock alone does not block unpublished reschedule", () => {
  const result = assertScheduleMoveAllowedByAssignmentGrain(
    [{ ...baseFact, isLocked: true, billingLocked: false }],
    { creatorIds: ["mirna"], campaignLineIds: ["line-1"] }
  );
  assert.equal(result.ok, true);
});

test("true billing lock still blocks reschedule", () => {
  const result = assertScheduleMoveAllowedByAssignmentGrain(
    [{ ...baseFact, isLocked: false, billingLocked: true }],
    { creatorIds: ["mirna"] }
  );
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected block");
  assert.match(result.message, /billing-locked|locked/i);
});

test("published live date blocks reschedule", () => {
  const result = assertScheduleMoveAllowedByAssignmentGrain(
    [
      {
        ...baseFact,
        liveDate: "2026-08-10",
        completed: true,
        isLocked: false,
        billingLocked: false,
      },
    ],
    { creatorIds: ["mirna"] }
  );
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("expected block");
  assert.match(result.message, /live Performance date/);
});
