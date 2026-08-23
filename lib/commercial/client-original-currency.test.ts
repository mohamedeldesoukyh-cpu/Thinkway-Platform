import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SHOW_ORIGINAL_CURRENCY_DEFAULT,
  metadataWithShowOriginalCurrency,
  readShowOriginalCurrency,
} from "./client-original-currency";

test("original currency is off unless metadata explicitly enables it", () => {
  assert.equal(SHOW_ORIGINAL_CURRENCY_DEFAULT, false);
  assert.equal(readShowOriginalCurrency(null), false);
  assert.equal(readShowOriginalCurrency({}), false);
  assert.equal(readShowOriginalCurrency({ showOriginalCurrency: false }), false);
  assert.equal(readShowOriginalCurrency({ showOriginalCurrency: true }), true);
});

test("original-currency metadata keeps other shortlist keys when toggling", () => {
  const enabled = metadataWithShowOriginalCurrency({ currency: "SAR" }, true);
  assert.equal(enabled.currency, "SAR");
  assert.equal(enabled.showOriginalCurrency, true);
  const disabled = metadataWithShowOriginalCurrency(enabled, false);
  assert.equal(disabled.currency, "SAR");
  assert.equal("showOriginalCurrency" in disabled, false);
});
