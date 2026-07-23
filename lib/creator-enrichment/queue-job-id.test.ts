import assert from "node:assert/strict";
import test from "node:test";

import { creatorEnrichmentJobId } from "./queue-impl";

test("force refresh job ids are stable (no Date.now)", () => {
  const a = creatorEnrichmentJobId({
    influencerId: "inf-1",
    trigger: "manual",
    priority: 4,
    force: true,
    scope: "metrics",
  });
  const b = creatorEnrichmentJobId({
    influencerId: "inf-1",
    trigger: "manual",
    priority: 4,
    force: true,
    scope: "metrics",
  });
  assert.equal(a, b);
  assert.equal(a, "creator-enrich-force-inf-1");
  assert.doesNotMatch(a, /\d{10,}/);
});

test("platform-scoped force jobs stay distinct per account", () => {
  assert.equal(
    creatorEnrichmentJobId({
      influencerId: "inf-1",
      trigger: "manual",
      priority: 4,
      force: true,
      platformAccountId: "pa-snap",
    }),
    "creator-enrich-force-inf-1-pa-snap"
  );
});
