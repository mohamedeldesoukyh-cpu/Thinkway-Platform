import assert from "node:assert/strict";

import {
  bullmqPriority,
  computeNextRefreshAt,
  decideEnrichment,
  isEnrichmentStale,
  priorityForTrigger,
  STALE_AFTER_MS,
} from "@/lib/creator-enrichment/policy";

const NOW = Date.UTC(2026, 6, 4, 0, 0, 0); // fixed clock
const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// 30-day freshness skip (spec §2.C)
// ---------------------------------------------------------------------------
assert.equal(isEnrichmentStale(null, NOW), true, "never enriched is stale");
assert.equal(isEnrichmentStale(undefined, NOW), true);
assert.equal(
  isEnrichmentStale(new Date(NOW - 29 * DAY).toISOString(), NOW),
  false,
  "29 days is still fresh"
);
assert.equal(
  isEnrichmentStale(new Date(NOW - 31 * DAY).toISOString(), NOW),
  true,
  "31 days is stale"
);
assert.equal(
  isEnrichmentStale(new Date(NOW - 30 * DAY).toISOString(), NOW),
  true,
  "exactly 30 days is stale (>=)"
);
assert.equal(isEnrichmentStale("not-a-date", NOW), true, "invalid date -> stale");

// decideEnrichment: fresh -> skip; forced never skips; stale -> run
assert.deepEqual(
  decideEnrichment({ lastEnrichedAt: new Date(NOW - 10 * DAY).toISOString(), now: NOW }),
  { skip: true, reason: "Fresh within 30 days" }
);
assert.equal(
  decideEnrichment({
    lastEnrichedAt: new Date(NOW - 10 * DAY).toISOString(),
    now: NOW,
    force: true,
  }).skip,
  false,
  "explicit Refresh bypasses the 30-day skip"
);
assert.equal(
  decideEnrichment({ lastEnrichedAt: new Date(NOW - 40 * DAY).toISOString(), now: NOW }).skip,
  false,
  "stale data is enriched"
);
assert.equal(
  decideEnrichment({ lastEnrichedAt: null, now: NOW }).skip,
  false,
  "never-enriched is enriched"
);

assert.equal(STALE_AFTER_MS, 30 * DAY);

// ---------------------------------------------------------------------------
// Priority assignment (spec §2.D): 1 campaign, 2 shortlist, 3 detail, 4 manual
// ---------------------------------------------------------------------------
assert.equal(priorityForTrigger("campaign"), 1);
assert.equal(priorityForTrigger("shortlist"), 2);
assert.equal(priorityForTrigger("detail"), 3);
assert.equal(priorityForTrigger("manual"), 4);
assert.equal(priorityForTrigger("stale"), 4);

// BullMQ priority preserves "lower = higher"
assert.equal(bullmqPriority(1), 1);
assert.equal(bullmqPriority(4), 4);
assert.ok(bullmqPriority(1) < bullmqPriority(2), "campaign outranks shortlist");

// ---------------------------------------------------------------------------
// Next-refresh scheduling scales with reach (credit preservation)
// ---------------------------------------------------------------------------
assert.equal(
  computeNextRefreshAt({ followers: 1_000_000, from: NOW }).getTime(),
  NOW + 7 * DAY,
  "mega creators refresh weekly"
);
assert.equal(
  computeNextRefreshAt({ followers: 100_000, from: NOW }).getTime(),
  NOW + 14 * DAY
);
assert.equal(
  computeNextRefreshAt({ followers: 1_000, from: NOW }).getTime(),
  NOW + 30 * DAY,
  "small creators refresh monthly"
);
assert.equal(
  computeNextRefreshAt({ followers: null, from: NOW }).getTime(),
  NOW + 30 * DAY
);

console.log("creator-enrichment policy tests passed");
