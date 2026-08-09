import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatQuotationCurrencyShort,
  formatQuotationCurrencySymbolFirst,
  formatQuotationFullNumber,
  formatQuotationMoneyDisplay,
  formatQuotationShortNumber,
} from "./quotation-template-format";

test("quotation display numbers round to whole values", () => {
  assert.equal(formatQuotationFullNumber(12_345.67), "12,346");
  assert.equal(formatQuotationFullNumber(12_345.4), "12,345");
  assert.equal(formatQuotationShortNumber(15_791_000), "16M");
  assert.equal(formatQuotationShortNumber(541_400), "541K");
  assert.equal(formatQuotationCurrencySymbolFirst(1_466.66, "EGP"), "EGP 1,467");
  assert.equal(formatQuotationCurrencyShort(3_500_000, "EGP"), "EGP 4M");
  assert.equal(formatQuotationCurrencyShort(268_333.34, "AED"), "AED 268K");
  assert.equal(formatQuotationMoneyDisplay("1,466.66 EGP").full, "EGP 1,467");
});
