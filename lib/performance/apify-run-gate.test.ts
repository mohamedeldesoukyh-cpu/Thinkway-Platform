import assert from "node:assert/strict";
import test from "node:test";

import {
  apifyRunGateKey,
  beginApifyRunGate,
  resetApifyRunGateForTests,
} from "./apify-run-gate";

test("blocks duplicate apify launches within cooldown", () => {
  resetApifyRunGateForTests();
  const key = apifyRunGateKey({
    actorId: "apify/instagram-scraper",
    platform: "instagram",
    identities: ["suhaibshashaa"],
    label: "profile-details",
  });

  assert.equal(beginApifyRunGate(key, 60_000).allowed, true);
  const second = beginApifyRunGate(key, 60_000);
  assert.equal(second.allowed, false);
  if (!second.allowed) {
    assert.match(second.reason, /Duplicate Apify run blocked/);
  }
});

test("allows distinct creators in parallel", () => {
  resetApifyRunGateForTests();
  const a = apifyRunGateKey({
    actorId: "apify/instagram-scraper",
    platform: "instagram",
    identities: ["creator-a"],
  });
  const b = apifyRunGateKey({
    actorId: "apify/instagram-scraper",
    platform: "instagram",
    identities: ["creator-b"],
  });
  assert.equal(beginApifyRunGate(a).allowed, true);
  assert.equal(beginApifyRunGate(b).allowed, true);
});
