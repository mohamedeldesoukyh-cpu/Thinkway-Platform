import { strict as assert } from "node:assert";
import { test } from "node:test";

import { computeSourceFingerprint } from "./deliverable-fingerprint";
import { buildCampaignObjectFixture } from "./deliverable-test-fixture";

test("same inputs produce a stable fingerprint", () => {
  const a = buildCampaignObjectFixture();
  const b = buildCampaignObjectFixture();
  assert.equal(
    computeSourceFingerprint(a, ["creators", "budget", "timeline"]),
    computeSourceFingerprint(b, ["creators", "budget", "timeline"])
  );
});

test("fingerprint is independent of input-key order", () => {
  const obj = buildCampaignObjectFixture();
  assert.equal(
    computeSourceFingerprint(obj, ["creators", "budget", "timeline"]),
    computeSourceFingerprint(obj, ["timeline", "budget", "creators"])
  );
});

test("changing creators changes the creators fingerprint", () => {
  const before = buildCampaignObjectFixture();
  const after = buildCampaignObjectFixture({
    creators: [{ id: "cr_only", name: "Solo", tier: "Micro" }],
  });
  assert.notEqual(
    computeSourceFingerprint(before, ["creators"]),
    computeSourceFingerprint(after, ["creators"])
  );
});

test("changing an unrelated input does not change the creators fingerprint", () => {
  const before = buildCampaignObjectFixture();
  const after = buildCampaignObjectFixture({ facts: { budget: { amount: 9_000_000, currency: "EGP" } } });
  // Budget changed, but the creators slice is identical.
  assert.equal(
    computeSourceFingerprint(before, ["creators"]),
    computeSourceFingerprint(after, ["creators"])
  );
  // ...and the budget slice differs.
  assert.notEqual(
    computeSourceFingerprint(before, ["budget"]),
    computeSourceFingerprint(after, ["budget"])
  );
});

test("creator fingerprint is stable across slate reordering", () => {
  const forward = buildCampaignObjectFixture({
    creators: [
      { id: "a", name: "A", tier: "Macro" },
      { id: "b", name: "B", tier: "Micro" },
    ],
  });
  const reversed = buildCampaignObjectFixture({
    creators: [
      { id: "b", name: "B", tier: "Micro" },
      { id: "a", name: "A", tier: "Macro" },
    ],
  });
  assert.equal(
    computeSourceFingerprint(forward, ["creators"]),
    computeSourceFingerprint(reversed, ["creators"])
  );
});
