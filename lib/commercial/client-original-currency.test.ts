import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HIDE_COST_AND_FEES_DEFAULT,
  SHOW_ORIGINAL_CURRENCY_DEFAULT,
  clientShowsCostAndFees,
  metadataWithClientWorkspaceDisplayPatch,
  metadataWithHideCostAndFees,
  metadataWithShowOriginalCurrency,
  readClientWorkspaceDisplayFlags,
  readHideCostAndFees,
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

test("hide cost and fees is off unless metadata explicitly enables it", () => {
  assert.equal(HIDE_COST_AND_FEES_DEFAULT, false);
  assert.equal(clientShowsCostAndFees(false), true);
  assert.equal(clientShowsCostAndFees(true), false);
  assert.equal(readHideCostAndFees(null), false);
  assert.equal(readHideCostAndFees({ hideCostAndFees: true }), true);
});

test("display flags keep original-currency and hide-cost keys independent", () => {
  const both = metadataWithClientWorkspaceDisplayPatch({ currency: "SAR" }, {
    showOriginalCurrency: true,
    hideCostAndFees: true,
  });
  assert.equal(both.currency, "SAR");
  assert.deepEqual(readClientWorkspaceDisplayFlags(both), {
    showOriginalCurrency: true,
    hideCostAndFees: true,
  });
  const feesOnly = metadataWithHideCostAndFees(both, false);
  assert.equal(feesOnly.showOriginalCurrency, true);
  assert.equal("hideCostAndFees" in feesOnly, false);
  assert.equal(feesOnly.currency, "SAR");
});
