import { strict as assert } from "node:assert";
import { test } from "node:test";

import { computeSourceFingerprint } from "./output-fingerprint";
import { buildCampaignObjectFixture } from "./output-test-fixture";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

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
  const after = buildCampaignObjectFixture({
    facts: { budget: { amount: 9_000_000, currency: "EGP" } },
  });
  assert.equal(
    computeSourceFingerprint(before, ["creators"]),
    computeSourceFingerprint(after, ["creators"])
  );
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

test("changing quotation ad type on a creator changes the creators fingerprint", () => {
  const before = buildCampaignObjectFixture();
  const after = buildCampaignObjectFixture();
  const data = after.sections.creators?.data as CreatorsSectionData;
  const reasoning = data.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) reasoning[0].serviceLabel = "2× IG Reel";

  assert.notEqual(
    computeSourceFingerprint(before, ["creators"]),
    computeSourceFingerprint(after, ["creators"])
  );
});
