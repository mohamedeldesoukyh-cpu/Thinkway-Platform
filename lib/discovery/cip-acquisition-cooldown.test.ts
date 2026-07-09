import assert from "node:assert/strict";

import { getCipAcquisitionCooldownMs } from "./cip-acquisition-cooldown";

const defaultMs = getCipAcquisitionCooldownMs();
assert.ok(defaultMs > 0, "default cooldown should be positive");

const original = process.env.CIP_ACQUISITION_COOLDOWN_MS;
process.env.CIP_ACQUISITION_COOLDOWN_MS = "0";
assert.equal(getCipAcquisitionCooldownMs(), 0);

if (original !== undefined) {
  process.env.CIP_ACQUISITION_COOLDOWN_MS = original;
} else {
  delete process.env.CIP_ACQUISITION_COOLDOWN_MS;
}

console.log("lib/discovery/cip-acquisition-cooldown.test.ts — all tests passed");
