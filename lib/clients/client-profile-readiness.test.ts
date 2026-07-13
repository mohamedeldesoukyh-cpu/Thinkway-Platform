import assert from "node:assert/strict";

import {
  assessClientOverviewCommercialReadiness,
  computeClientProfileTabMissingCounts,
} from "./client-profile-readiness";

const completeCommercial = assessClientOverviewCommercialReadiness({
  client_category: "fmcg",
  client_subcategory: "food",
  agency_or_direct: "agency",
  country: "AE",
  city: "Dubai",
  billing_email: "billing@example.com",
});
assert.equal(completeCommercial.complete, true);
assert.deepEqual(completeCommercial.missing, []);

const missingVrOnly = assessClientOverviewCommercialReadiness({
  client_category: "fmcg",
  client_subcategory: "food",
  agency_or_direct: "agency",
  country: "AE",
  city: "Dubai",
  billing_email: "billing@example.com",
});
assert.equal(missingVrOnly.complete, true, "VR% is not part of commercial completeness");

const incompleteCommercial = assessClientOverviewCommercialReadiness({
  client_category: null,
  client_subcategory: null,
  agency_or_direct: "agency",
  country: "AE",
  city: null,
  billing_email: null,
});
assert.equal(incompleteCommercial.complete, false);
assert.ok(incompleteCommercial.missing.includes("Category"));
assert.ok(incompleteCommercial.missing.includes("Subcategory"));
assert.ok(incompleteCommercial.missing.includes("City"));
assert.ok(incompleteCommercial.missing.includes("Billing email"));
assert.equal(incompleteCommercial.missing.includes("Default VR%"), false);

const tabCounts = computeClientProfileTabMissingCounts({
  id: "client-1",
  brands: [],
  documents: [],
  campaigns: [],
  client_category: null,
  client_subcategory: null,
  agency_or_direct: "agency",
  country: "AE",
  city: null,
  billing_email: null,
  trade_license_number: null,
  trade_license_expiry: null,
  vat_number: null,
  tax_id: null,
  legal_address: null,
  legal_completed_at: null,
  finance_completed_at: null,
  credit_limit_active: true,
} as never);

assert.equal(tabCounts.brands, 1, "no brands shows one missing");
assert.ok((tabCounts.overview ?? 0) >= 3, "overview shows commercial missing count");
assert.ok(tabCounts.legal != null && tabCounts.legal > 0, "legal shows field missing count");
assert.equal(tabCounts.finance, 1, "finance approval missing when credit limit active");

const financeSkippedCounts = computeClientProfileTabMissingCounts({
  id: "client-2",
  brands: [{ id: "b1" }],
  documents: [{ document_type: "tax_certificate" }],
  campaigns: [],
  client_category: "fmcg",
  client_subcategory: "food",
  agency_or_direct: "agency",
  country: "AE",
  city: "Dubai",
  billing_email: "billing@example.com",
  trade_license_number: "123",
  trade_license_expiry: "2027-01-01",
  vat_number: "VAT",
  tax_id: "TAX",
  legal_address: { line1: "Line 1", country: "AE", city: "Dubai" },
  legal_completed_at: "2026-01-01T00:00:00.000Z",
  tax_completed_at: null,
  finance_completed_at: null,
  credit_limit_active: false,
} as never);

assert.equal(financeSkippedCounts.overview, undefined);
assert.equal(financeSkippedCounts.brands, undefined);
assert.equal(financeSkippedCounts.finance, undefined);
assert.equal(financeSkippedCounts.legal, undefined, "tax complete when tax_id and certificate present after auto-complete path");

const taxPendingCounts = computeClientProfileTabMissingCounts({
  id: "client-3",
  brands: [{ id: "b1" }],
  documents: [],
  campaigns: [],
  client_category: "fmcg",
  client_subcategory: "food",
  agency_or_direct: "agency",
  country: "AE",
  city: "Dubai",
  billing_email: "billing@example.com",
  trade_license_number: "123",
  trade_license_expiry: "2027-01-01",
  vat_number: "VAT",
  tax_id: null,
  legal_address: { line1: "Line 1", country: "AE", city: "Dubai" },
  legal_completed_at: "2026-01-01T00:00:00.000Z",
  tax_completed_at: null,
  finance_completed_at: null,
  credit_limit_active: false,
} as never);

assert.equal(taxPendingCounts.legal, 2, "legal tab shows tax ID and certificate missing");

console.log("client-profile-readiness.test.ts: all assertions passed");
