import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coerceOptionalMetricNumber } from "./manual-metric-number";

describe("coerceOptionalMetricNumber", () => {
  it("parses compact and plain counts", () => {
    assert.equal(coerceOptionalMetricNumber("1.1K"), 1100);
    assert.equal(coerceOptionalMetricNumber("83687"), 83687);
    assert.equal(coerceOptionalMetricNumber("1,234"), 1234);
    assert.equal(coerceOptionalMetricNumber(42), 42);
  });

  it("maps empty and invalid to null", () => {
    assert.equal(coerceOptionalMetricNumber(""), null);
    assert.equal(coerceOptionalMetricNumber("   "), null);
    assert.equal(coerceOptionalMetricNumber(null), null);
    assert.equal(coerceOptionalMetricNumber(Number.NaN), null);
    assert.equal(coerceOptionalMetricNumber("abc"), null);
  });
});
