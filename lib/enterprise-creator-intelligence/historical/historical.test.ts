import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeFollowerDifference,
  computeMedian,
  computeMonthlyGrowthRate,
  computePostingFrequencyPerWeek,
  deriveGrowthTrend,
} from "@/lib/enterprise-creator-intelligence/historical/compute";
import {
  previousPeriodMonth,
  toPeriodMonth,
} from "@/lib/enterprise-creator-intelligence/historical/period";
import { buildHistoricalAiHints } from "@/lib/enterprise-creator-intelligence/historical/load-monthly";

describe("Enterprise Creator Intelligence — Historical Sprint 1", () => {
  it("normalizes captures to UTC period months", () => {
    assert.equal(toPeriodMonth("2026-07-15T12:00:00.000Z"), "2026-07-01");
    assert.equal(previousPeriodMonth("2026-07-01"), "2026-06-01");
    assert.equal(previousPeriodMonth("2026-01-01"), "2025-12-01");
  });

  it("computes median views without mutating source order", () => {
    assert.equal(computeMedian([10, 30, 20]), 20);
    assert.equal(computeMedian([10, 20, 30, 40]), 25);
    assert.equal(computeMedian([]), null);
    assert.equal(computeMedian([null, 5]), 5);
  });

  it("computes monthly growth and follower difference", () => {
    assert.equal(computeFollowerDifference(1200, 1000), 200);
    assert.equal(computeMonthlyGrowthRate(1200, 1000), 0.2);
    assert.equal(computeMonthlyGrowthRate(1000, 0), null);
    assert.equal(computeFollowerDifference(null, 1000), null);
  });

  it("estimates posting frequency from publication timestamps", () => {
    // 4 posts spanning 21 days → 4 / (21/7) ≈ 1.333 posts/week
    const freq = computePostingFrequencyPerWeek([
      "2026-07-01T00:00:00.000Z",
      "2026-07-08T00:00:00.000Z",
      "2026-07-15T00:00:00.000Z",
      "2026-07-22T00:00:00.000Z",
    ]);
    assert.ok(freq != null);
    assert.ok(freq! >= 1.3 && freq! <= 1.4);
    assert.equal(computePostingFrequencyPerWeek([]), null);
  });

  it("exposes AI-ready growth hints without running AI", () => {
    const hints = buildHistoricalAiHints({
      influencerId: "inf-1",
      platform: "instagram",
      months: [
        {
          influencerId: "inf-1",
          platform: "instagram",
          periodMonth: "2026-05-01",
          followers: 1000,
          following: 100,
          postsCount: 50,
          avgViews: 1000,
          medianViews: 900,
          engagementRate: 2.1,
          postingFrequencyPerWeek: 1,
          monthlyGrowthRate: null,
          followerDifference: null,
          sampleCaptureCount: 1,
          source: "test",
          computedAt: "2026-05-02T00:00:00.000Z",
        },
        {
          influencerId: "inf-1",
          platform: "instagram",
          periodMonth: "2026-06-01",
          followers: 1100,
          following: 100,
          postsCount: 55,
          avgViews: 1100,
          medianViews: 1000,
          engagementRate: 2.2,
          postingFrequencyPerWeek: 1.1,
          monthlyGrowthRate: 0.1,
          followerDifference: 100,
          sampleCaptureCount: 2,
          source: "test",
          computedAt: "2026-06-02T00:00:00.000Z",
        },
      ],
    });
    assert.equal(hints.seriesAvailable, true);
    assert.equal(hints.monthCount, 2);
    assert.equal(hints.growthTrend, "up");
    assert.equal(hints.recommendRefresh, false);
    assert.equal(deriveGrowthTrend([{ monthlyGrowthRate: -0.05 }]), "down");
  });
});
