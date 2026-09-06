import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  batchRefreshProgress,
  enrichmentStatusToRefreshProgress,
} from "./refresh-metrics-progress";

describe("enrichmentStatusToRefreshProgress", () => {
  it("maps in-flight stages to progress percents", () => {
    assert.deepEqual(enrichmentStatusToRefreshProgress("queued"), {
      percent: 18,
      tone: "progress",
      label: "Queued",
    });
    assert.deepEqual(enrichmentStatusToRefreshProgress("running"), {
      percent: 62,
      tone: "progress",
      label: "Collecting",
    });
    assert.deepEqual(
      enrichmentStatusToRefreshProgress("never", { isPending: true }),
      { percent: 8, tone: "progress", label: "Starting" }
    );
  });

  it("hides idle terminals unless includeTerminal", () => {
    assert.equal(enrichmentStatusToRefreshProgress("enriched"), null);
    assert.equal(enrichmentStatusToRefreshProgress("failed"), null);
    assert.deepEqual(
      enrichmentStatusToRefreshProgress("failed", { includeTerminal: true }),
      { percent: 100, tone: "failed", label: "Failed" }
    );
    assert.deepEqual(
      enrichmentStatusToRefreshProgress("partial", { includeTerminal: true }),
      { percent: 100, tone: "partial", label: "Partial" }
    );
    assert.deepEqual(
      enrichmentStatusToRefreshProgress("enriched", { includeTerminal: true }),
      { percent: 100, tone: "done", label: "Done" }
    );
  });
});

describe("batchRefreshProgress", () => {
  it("reports progress while collecting", () => {
    assert.deepEqual(batchRefreshProgress({ total: 4, completed: 1, failed: 0 }), {
      percent: 25,
      tone: "progress",
      label: "Collecting 1 of 4",
    });
  });

  it("tones terminal batch by failures", () => {
    assert.equal(
      batchRefreshProgress({ total: 3, completed: 3, failed: 0 }).tone,
      "done"
    );
    assert.equal(
      batchRefreshProgress({ total: 3, completed: 3, failed: 1 }).tone,
      "partial"
    );
    assert.equal(
      batchRefreshProgress({ total: 2, completed: 2, failed: 2 }).tone,
      "failed"
    );
  });
});
