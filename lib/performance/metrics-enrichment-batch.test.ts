import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countUniqueCreatorsInBatch,
  isMetricsEnrichmentBatchComplete,
  metricsEnrichmentProgressPercent,
  summarizeMetricsEnrichmentBatch,
} from "./metrics-enrichment-batch";

describe("metrics-enrichment-batch", () => {
  it("summarizes batch statuses and progress", () => {
    const rows = [
      { id: "a", influencer_id: "c1", metrics_refresh_status: "completed" },
      { id: "b", influencer_id: "c2", metrics_refresh_status: "queued" },
      { id: "c", influencer_id: "c1", metrics_refresh_status: "failed" },
      { id: "d", influencer_id: "c3", metrics_refresh_status: "partial" },
    ];
    const health = summarizeMetricsEnrichmentBatch(rows, ["a", "b", "c", "d"]);
    assert.equal(health.total, 4);
    assert.equal(health.synced, 1);
    assert.equal(health.queued, 1);
    assert.equal(health.failed, 1);
    assert.equal(health.partial, 1);
    assert.equal(metricsEnrichmentProgressPercent(health), 75);
    assert.equal(isMetricsEnrichmentBatchComplete(health), false);
    assert.equal(countUniqueCreatorsInBatch(rows, ["a", "b", "c", "d"]), 3);
  });

  it("marks batch complete when every id is terminal", () => {
    const rows = [
      { id: "a", metrics_refresh_status: "completed" },
      { id: "b", metrics_refresh_status: "manual_required" },
    ];
    const health = summarizeMetricsEnrichmentBatch(rows, ["a", "b"]);
    assert.equal(isMetricsEnrichmentBatchComplete(health), true);
    assert.equal(metricsEnrichmentProgressPercent(health), 100);
  });
});
