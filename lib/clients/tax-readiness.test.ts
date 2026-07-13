import assert from "node:assert/strict";

import { assessClientTaxReadiness } from "./tax-readiness";

const completeInput = {
  tax_id: "777-335-255",
  documentTypes: ["tax_certificate"],
};

const result = assessClientTaxReadiness(completeInput);
assert.equal(result.complete, true);
assert.deepEqual(result.missing, []);

const missingId = assessClientTaxReadiness({
  tax_id: null,
  documentTypes: ["tax_certificate"],
});
assert.equal(missingId.complete, false);
assert.ok(missingId.missing.includes("Tax ID"));

const missingDoc = assessClientTaxReadiness({
  tax_id: "777-335-255",
  documentTypes: [],
});
assert.equal(missingDoc.complete, false);
assert.ok(missingDoc.missing.includes("Tax certificate"));

console.log("tax-readiness.test.ts: all assertions passed");
