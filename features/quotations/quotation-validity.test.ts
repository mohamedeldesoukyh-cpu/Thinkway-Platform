import assert from "node:assert/strict";

import {
  defaultValidityDateFromIssue,
  formatValidityLabel,
  isQuotationExpired,
  validDaysRemaining,
} from "@/features/quotations/quotation-validity";

assert.equal(defaultValidityDateFromIssue("2026-06-01"), "2026-06-16");

const future = validDaysRemaining("2099-01-01", new Date("2026-01-01"));
assert.ok(future != null && future > 0);

assert.equal(isQuotationExpired("2020-01-01", new Date("2026-01-01")), true);
assert.equal(isQuotationExpired("2099-01-01", new Date("2026-01-01")), false);
assert.ok(formatValidityLabel("2099-01-01").startsWith("Valid for"));

console.log("quotation-validity.test.ts passed");
