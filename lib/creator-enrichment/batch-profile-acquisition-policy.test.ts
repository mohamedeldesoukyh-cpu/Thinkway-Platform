import { describe, expect, it } from "vitest";

import {
  estimateBatchProfileAcquisitionUsage,
  getBatchProfileAcquisitionConfig,
} from "./batch-profile-acquisition-policy";

describe("batch-profile-acquisition-policy", () => {
  it("chunks profiles into batches and estimates instagram as two runs per batch", () => {
    const config = { ...getBatchProfileAcquisitionConfig(), batchSize: 75 };
    const usage = estimateBatchProfileAcquisitionUsage({
      profileCount: 100,
      platform: "instagram",
      config,
    });
    expect(usage.batchCount).toBe(2);
    expect(usage.estimatedApifyRuns).toBe(4);
    expect(usage.estimatedCredits).toBeGreaterThan(0);
  });

  it("estimates tiktok as one run per batch", () => {
    const config = { ...getBatchProfileAcquisitionConfig(), batchSize: 50 };
    const usage = estimateBatchProfileAcquisitionUsage({
      profileCount: 50,
      platform: "tiktok",
      config,
    });
    expect(usage.batchCount).toBe(1);
    expect(usage.estimatedApifyRuns).toBe(1);
  });
});
