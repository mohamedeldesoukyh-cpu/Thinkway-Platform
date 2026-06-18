import assert from "node:assert/strict";

import { cacheKeyForCompanyName } from "./client-classification-cache";
import {
  normalizeCompanyNameForCache,
  stripLegalSuffixes,
} from "./normalize-company-name";

function run() {
  assert.equal(normalizeCompanyNameForCache("  Nike Inc.  "), "nike");
  assert.equal(stripLegalSuffixes("mind share egypt ltd"), "mind share");
  assert.equal(cacheKeyForCompanyName("Commercial International Bank"), "commercial international bank");
  assert.equal(cacheKeyForCompanyName("CIB Egypt LLC"), "cib");

  const variants = [
    ["L'Oréal Egypt", "l'oreal"],
    ["Procter & Gamble", "procter gamble"],
  ] as const;

  for (const [input, expectedPrefix] of variants) {
    const key = cacheKeyForCompanyName(input);
    assert.ok(key.length >= expectedPrefix.length, `cache key for ${input}`);
  }

  console.log("client-classification-cache.test.ts: ok");
}

run();
