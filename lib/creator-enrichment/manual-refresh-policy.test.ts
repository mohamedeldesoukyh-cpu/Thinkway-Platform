import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getManualRefreshCachePromptThresholdHours,
  isWithinManualRefreshPromptWindow,
  shouldPromptManualRefreshCache,
} from "./manual-refresh-policy";

test("manual refresh prompt threshold defaults to 24 hours", () => {
  assert.equal(getManualRefreshCachePromptThresholdHours(), 24);
});

test("isWithinManualRefreshPromptWindow respects threshold", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");
  const recent = "2026-07-19T10:00:00.000Z";
  const old = "2026-07-17T10:00:00.000Z";

  assert.equal(isWithinManualRefreshPromptWindow(recent, now), true);
  assert.equal(isWithinManualRefreshPromptWindow(old, now), false);
  assert.equal(isWithinManualRefreshPromptWindow(null, now), false);
});

test("shouldPromptManualRefreshCache requires valid snapshot and recent activity", () => {
  const now = Date.parse("2026-07-19T12:00:00.000Z");
  const recent = "2026-07-19T10:00:00.000Z";

  assert.equal(
    shouldPromptManualRefreshCache({
      hasValidSnapshot: false,
      lastEnrichedAt: recent,
      lastLiveFetchAt: recent,
      now,
    }),
    false
  );

  assert.equal(
    shouldPromptManualRefreshCache({
      hasValidSnapshot: true,
      lastEnrichedAt: null,
      lastLiveFetchAt: null,
      now,
    }),
    false
  );

  assert.equal(
    shouldPromptManualRefreshCache({
      hasValidSnapshot: true,
      lastEnrichedAt: recent,
      lastLiveFetchAt: null,
      now,
    }),
    true
  );

  assert.equal(
    shouldPromptManualRefreshCache({
      hasValidSnapshot: true,
      lastEnrichedAt: null,
      lastLiveFetchAt: recent,
      now,
    }),
    true
  );
});
