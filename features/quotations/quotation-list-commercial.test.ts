import assert from "node:assert/strict";
import { quotationListClientCost } from "./quotation-list-commercial";
assert.equal(quotationListClientCost({ total_revenue_egp: 2230000, total_af_egp: 223000 }), 2453000);
assert.equal(quotationListClientCost({ total_revenue_egp: 100, total_af_egp: 0 }), 100);
assert.equal(quotationListClientCost({ total_revenue_egp: 0, total_af_egp: 0 }), 0);
assert.equal(quotationListClientCost({ total_revenue_egp: 100 }), 100);
assert.equal(quotationListClientCost({ total_revenue_egp: 0.1, total_af_egp: 0.2 }), 0.3);
// Stored EGP amounts must not be converted twice for foreign currency quotations.
assert.equal(quotationListClientCost({ total_revenue_egp: 50000, total_af_egp: 7500 }), 57500);
console.log("Quotation list client cost tests passed.");
