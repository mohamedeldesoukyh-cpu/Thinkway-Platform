import assert from "node:assert/strict";
import test from "node:test";

import {
  estimateBatchProfileAcquisitionUsage,
  getBatchProfileAcquisitionConfig,
} from "./batch-profile-acquisition-policy";

test("chunks profiles into batches and estimates instagram as two runs when posts included", () => {
  const config = { ...getBatchProfileAcquisitionConfig(), batchSize: 75 };
  const usage = estimateBatchProfileAcquisitionUsage({
    profileCount: 100,
    platform: "instagram",
    scope: "all",
    config,
  });
  assert.equal(usage.batchCount, 2);
  assert.equal(usage.estimatedApifyRuns, 4);
  assert.ok(usage.estimatedCredits > 0);
});

test("metrics scope estimates one instagram run per batch (no posts actor)", () => {
  const config = { ...getBatchProfileAcquisitionConfig(), batchSize: 75 };
  const usage = estimateBatchProfileAcquisitionUsage({
    profileCount: 100,
    platform: "instagram",
    scope: "metrics",
    config,
  });
  assert.equal(usage.batchCount, 2);
  assert.equal(usage.estimatedApifyRuns, 2);
});

test("estimates tiktok as one run per batch", () => {
  const config = { ...getBatchProfileAcquisitionConfig(), batchSize: 50 };
  const usage = estimateBatchProfileAcquisitionUsage({
    profileCount: 50,
    platform: "tiktok",
    config,
  });
  assert.equal(usage.batchCount, 1);
  assert.equal(usage.estimatedApifyRuns, 1);
});

test("estimates snapchat as one run per batch", () => {
  const usage = estimateBatchProfileAcquisitionUsage({
    profileCount: 10,
    platform: "snapchat",
    scope: "metrics",
  });
  assert.equal(usage.batchCount, 1);
  assert.equal(usage.estimatedApifyRuns, 1);
});
