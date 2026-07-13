import assert from "node:assert/strict";

import { assessClientLegalReadiness } from "./legal-readiness";

const completeInput = {
  trade_license_number: "52727",
  trade_license_expiry: "2027-12-31",
  vat_number: "4486486263396264",
  legal_address: {
    line1: "Business Bay Tower",
    country: "AE",
    city: "Dubai",
  },
  documentTypes: ["trade_license", "vat_certificate"],
};

const result = assessClientLegalReadiness(completeInput);
assert.equal(result.complete, true);
assert.deepEqual(result.missing, []);

const missingExpiry = assessClientLegalReadiness({
  ...completeInput,
  trade_license_expiry: null,
});
assert.equal(missingExpiry.complete, false);
assert.ok(missingExpiry.missing.includes("Trade license expiry date"));

const missingDoc = assessClientLegalReadiness({
  ...completeInput,
  documentTypes: ["trade_license"],
});
assert.equal(missingDoc.complete, false);
assert.ok(missingDoc.missing.includes("VAT certificate"));
assert.equal(missingDoc.missing.includes("Tax certificate"), false);

console.log("legal-readiness.test.ts: all assertions passed");
