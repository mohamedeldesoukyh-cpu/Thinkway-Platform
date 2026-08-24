import assert from "node:assert/strict";
import test from "node:test";

import { classifyMergeReassignError, evaluateMergeCreatorsEligibility } from "./merge-creators";

test("evaluateMergeCreatorsEligibility allows complementary platforms", () => {
  const result = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "instagram" }],
    sourcePlatforms: [{ platform: "tiktok" }],
  });

  assert.equal(result.canMerge, true);
  assert.deepEqual(result.platformsToMove, ["tiktok"]);
  assert.deepEqual(result.platformConflicts, []);
});

test("evaluateMergeCreatorsEligibility blocks overlapping platforms", () => {
  const result = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "instagram" }, { platform: "tiktok" }],
    sourcePlatforms: [{ platform: "tiktok" }, { platform: "youtube" }],
  });

  assert.equal(result.canMerge, false);
  assert.deepEqual(result.platformConflicts, ["TikTok"]);
  assert.deepEqual(result.platformsToMove, ["youtube"]);
});

test("evaluateMergeCreatorsEligibility blocks when no new platforms move", () => {
  const result = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "instagram" }, { platform: "tiktok" }],
    sourcePlatforms: [{ platform: "instagram" }],
  });

  assert.equal(result.canMerge, false);
  assert.match(result.message, /already have/i);
});

test("evaluateMergeCreatorsEligibility treats mixed-case platforms as the same", () => {
  const conflict = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "Snapchat" }],
    sourcePlatforms: [{ platform: "snapchat" }],
  });
  assert.equal(conflict.canMerge, false);
  assert.ok(conflict.platformConflicts.length > 0);

  const complementary = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "Instagram" }],
    sourcePlatforms: [{ platform: "Snapchat" }],
  });
  assert.equal(complementary.canMerge, true);
  assert.deepEqual(complementary.platformsToMove, ["snapchat"]);
});

test("classifyMergeReassignError treats unique and missing-table errors as recoverable", () => {
  assert.equal(
    classifyMergeReassignError(
      'duplicate key value violates unique constraint "creator_intelligence_monthly_metrics_unique"'
    ),
    "unique"
  );
  assert.equal(
    classifyMergeReassignError("Could not find the table 'public.vendor_statements' in the schema cache"),
    "missing"
  );
  assert.equal(
    classifyMergeReassignError("permission denied for table creator_enrichment_runs"),
    "fatal"
  );
});
