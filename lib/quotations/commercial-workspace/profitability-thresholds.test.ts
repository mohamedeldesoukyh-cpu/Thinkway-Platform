import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveProfitabilityBand } from "./profitability-thresholds";

describe("resolveProfitabilityBand", () => {
  it("classifies healthy / warning / critical by defaults", () => {
    assert.equal(resolveProfitabilityBand(25), "healthy");
    assert.equal(resolveProfitabilityBand(24.99), "warning");
    assert.equal(resolveProfitabilityBand(15), "warning");
    assert.equal(resolveProfitabilityBand(14.99), "critical");
  });
});
