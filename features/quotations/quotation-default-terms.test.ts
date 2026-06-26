import assert from "node:assert/strict";

import { formatQuotationTermsText, parseQuotationTermsText } from "@/features/quotations/quotation-default-terms";

const formatted = formatQuotationTermsText();
assert.ok(formatted.includes("Quotation Validity"));
assert.ok(formatted.includes("Confidentiality"));
assert.ok(
  formatted.includes("Full payment is due in advance prior to campaign launch"),
  "default payment terms should require payment in advance"
);

const roundTrip = formatQuotationTermsText(parseQuotationTermsText(formatted));
assert.ok(roundTrip.includes("Payment Terms"));

console.log("quotation-default-terms.test.ts passed");
