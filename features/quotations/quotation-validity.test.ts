import assert from "node:assert/strict";

import {
  defaultValidityDateFromIssue,
  formatConvertedQuotationValidityLabel,
  formatValidityLabel,
  isQuotationExpired,
  isQuotationOfferExpired,
  quotationIsConvertedToCampaign,
  validDaysRemaining,
} from "@/features/quotations/quotation-validity";

assert.equal(defaultValidityDateFromIssue("2026-06-01"), "2026-06-16");

const future = validDaysRemaining("2099-01-01", new Date("2026-01-01"));
assert.ok(future != null && future > 0);

assert.equal(isQuotationExpired("2020-01-01", new Date("2026-01-01")), true);
assert.equal(isQuotationExpired("2099-01-01", new Date("2026-01-01")), false);
assert.ok(formatValidityLabel("2099-01-01").startsWith("Valid for"));

assert.equal(
  quotationIsConvertedToCampaign({ campaignHeaderId: "hdr-1", status: "approved" }),
  true
);
assert.equal(
  quotationIsConvertedToCampaign({ campaignHeaderId: null, status: "accepted" }),
  true
);
assert.equal(
  quotationIsConvertedToCampaign({ campaignHeaderId: null, status: "approved" }),
  false
);
assert.equal(
  isQuotationOfferExpired({
    validityDate: "2020-01-01",
    campaignHeaderId: "hdr-1",
    status: "approved",
    asOf: new Date("2026-01-01"),
  }),
  false
);
assert.equal(
  isQuotationOfferExpired({
    validityDate: "2020-01-01",
    campaignHeaderId: null,
    status: "approved",
    asOf: new Date("2026-01-01"),
  }),
  true
);
assert.equal(
  isQuotationOfferExpired({
    validityDate: "2020-01-01",
    campaignHeaderId: null,
    status: "accepted",
    asOf: new Date("2026-01-01"),
  }),
  false
);
assert.equal(
  formatConvertedQuotationValidityLabel({
    validityDate: "2020-01-01",
    campaignHeaderId: "hdr-1",
    status: "approved",
  }),
  "Converted — no expiry"
);

console.log("quotation-validity.test.ts passed");
