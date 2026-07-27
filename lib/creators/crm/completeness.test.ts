import assert from "node:assert/strict";
import test from "node:test";

import { computeCompletenessBreakdown } from "./completeness";

test("computeCompletenessBreakdown flags missing bank and passport", () => {
  const result = computeCompletenessBreakdown({
    influencer: {
      display_name: "Ada",
      email: "ada@example.com",
      phone: null,
      country_code: "AE",
      legal_name: "Ada Lovelace",
      rate_card: { base_rate: 1000, currency: "USD" },
      payment_details: {},
      payment_terms: "net_30",
      vat_registered: false,
      tax_registration_number: null,
      contract_status: "none",
    },
    platformCount: 1,
    documentTypes: [],
    bankAccountCount: 0,
    verifiedDefaultBank: false,
  });

  assert.ok(result.overall < 100);
  assert.ok(result.missing.some((m) => m.code === "passport"));
  assert.ok(result.missing.some((m) => m.code === "bank"));
  assert.equal(result.dimensions.identity > 0, true);
});

test("computeCompletenessBreakdown client compliance missing docs", () => {
  const result = computeCompletenessBreakdown({
    influencer: {
      display_name: "Ada",
      email: "a@b.c",
      phone: null,
      country_code: "AE",
      legal_name: null,
      rate_card: { base_rate: 1 },
      payment_details: { iban: "AE00" },
      payment_terms: "net_15",
      vat_registered: false,
      tax_registration_number: null,
      contract_status: null,
    },
    platformCount: 1,
    documentTypes: ["passport"],
    bankAccountCount: 1,
    verifiedDefaultBank: true,
    clientRequiredDocTypes: ["trade_licence", "passport"],
  });

  assert.ok(result.missing.some((m) => m.code === "client_trade_licence"));
  assert.ok(result.dimensions.client_compliance < 100);
});
