import assert from "node:assert/strict";

import { campaignLineSuffix } from "./campaign-line-suffix";

assert.equal(campaignLineSuffix(0), "A");
assert.equal(campaignLineSuffix(25), "Z");
assert.equal(campaignLineSuffix(26), "AA");
assert.equal(campaignLineSuffix(27), "AB");
assert.equal(campaignLineSuffix(51), "AZ");
assert.equal(campaignLineSuffix(52), "BA");

assert.notEqual(campaignLineSuffix(26), String.fromCharCode(65 + 26));
assert.throws(() => campaignLineSuffix(-1));

console.log("campaign-line-suffix.test.ts — all tests passed");
