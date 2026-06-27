import assert from "node:assert/strict";

import {
  STUCK_COLLECTING_THRESHOLD_MS,
  STUCK_QUEUED_THRESHOLD_MS,
  isStuckCollectingRow,
  isStuckQueuedRow,
  shouldMarkStuckCollectingAsFailed,
  shouldMarkStuckQueuedAsFailed,
} from "@/lib/performance/metrics-collector/recover-stuck-metric-collections";
import { isMetricsJobAttemptsExhausted } from "@/lib/performance/metrics-collector/job-failure";

const NOW = Date.parse("2026-06-27T12:00:00.000Z");

function row(
  overrides: Partial<{
    id: string;
    campaign_header_id: string;
    metrics_refresh_status: string;
    metrics_refresh_attempted_at: string | null;
    updated_at: string | null;
  }> = {}
) {
  return {
    id: "pub-1",
    campaign_header_id: "camp-1",
    metrics_refresh_status: "collecting",
    metrics_refresh_attempted_at: "2026-06-27T11:30:00.000Z",
    updated_at: "2026-06-27T11:30:00.000Z",
    ...overrides,
  };
}

{
  const recent = row({
    metrics_refresh_attempted_at: "2026-06-27T11:50:00.000Z",
  });
  assert.equal(isStuckCollectingRow(recent, NOW), false);
}

{
  const stale = row({
    metrics_refresh_attempted_at: "2026-06-27T11:44:00.000Z",
  });
  assert.equal(isStuckCollectingRow(stale, NOW), true);
}

{
  const noTimestamp = row({ metrics_refresh_attempted_at: null });
  assert.equal(isStuckCollectingRow(noTimestamp, NOW), true);
}

{
  const notCollecting = row({ metrics_refresh_status: "queued" });
  assert.equal(isStuckCollectingRow(notCollecting, NOW), false);
}

{
  const stale = row({
    metrics_refresh_attempted_at: "2026-06-27T11:44:00.000Z",
  });
  assert.equal(shouldMarkStuckCollectingAsFailed(stale, NOW, false), true);
  assert.equal(shouldMarkStuckCollectingAsFailed(stale, NOW, true), false);
}

{
  assert.equal(isMetricsJobAttemptsExhausted(2, 3), false);
  assert.equal(isMetricsJobAttemptsExhausted(3, 3), true);
}

{
  const staleQueued = row({
    metrics_refresh_status: "queued",
    metrics_refresh_attempted_at: null,
    updated_at: "2026-06-27T11:40:00.000Z",
  });
  assert.equal(isStuckQueuedRow(staleQueued, NOW), true);
  assert.equal(shouldMarkStuckQueuedAsFailed(staleQueued, NOW, false), true);
  assert.equal(shouldMarkStuckQueuedAsFailed(staleQueued, NOW, true), false);
}

{
  const recentQueued = row({
    metrics_refresh_status: "queued",
    metrics_refresh_attempted_at: null,
    updated_at: "2026-06-27T11:55:00.000Z",
  });
  assert.equal(isStuckQueuedRow(recentQueued, NOW), false);
}

{
  assert.equal(STUCK_COLLECTING_THRESHOLD_MS, 15 * 60 * 1000);
  assert.equal(STUCK_QUEUED_THRESHOLD_MS, 10 * 60 * 1000);
}

console.log("recover-stuck-metric-collections tests passed");
