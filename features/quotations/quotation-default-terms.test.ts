import assert from "node:assert/strict";

import { formatQuotationTermsText, parseQuotationTermsText } from "@/features/quotations/quotation-default-terms";

const formatted = formatQuotationTermsText();
assert.ok(formatted.includes("Quotation Validity"));
assert.ok(formatted.includes("Confidentiality"));

const roundTrip = formatQuotationTermsText(parseQuotationTermsText(formatted));
assert.ok(roundTrip.includes("Payment Terms"));

console.log("quotation-default-terms.test.ts passed");
