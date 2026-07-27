import assert from "node:assert/strict";
import test from "node:test";

import {
  computePaymentReadiness,
  resolvePaymentBankAccount,
} from "./payment-readiness";

test("payment readiness passes with IBAN and required fields", () => {
  const result = computePaymentReadiness({
    bank: {
      beneficiary_name: "Ada Lovelace",
      relationship_type: "account_owner",
      bank_name: "AAIB",
      currency: "EGP",
      swift: "ARAIEGCX",
      iban: "EG380019000500000000263180002",
      account_number: null,
    },
    documentTypes: [],
  });
  assert.equal(result.ready, true);
  assert.equal(result.missing.length, 0);
  assert.ok(result.warnings.some((w) => w.code === "passport"));
});

test("payment readiness accepts account number without IBAN", () => {
  const result = computePaymentReadiness({
    bank: {
      beneficiary_name: "Ada",
      relationship_type: "agency",
      bank_name: "CIB",
      currency: "USD",
      swift: "CIBEEGCX",
      iban: "",
      account_number: "1234567890",
    },
  });
  assert.equal(result.ready, true);
});

test("payment readiness fails when both IBAN and account missing", () => {
  const result = computePaymentReadiness({
    bank: {
      beneficiary_name: "Ada",
      relationship_type: "account_owner",
      bank_name: "CIB",
      currency: "EGP",
      swift: "CIBEEGCX",
      iban: "",
      account_number: "",
    },
  });
  assert.equal(result.ready, false);
  assert.ok(result.missing.some((m) => m.code === "iban_or_account_number"));
});

test("relationship other requires description", () => {
  const result = computePaymentReadiness({
    bank: {
      beneficiary_name: "Ada",
      relationship_type: "other",
      relationship_description: "",
      bank_name: "CIB",
      currency: "EGP",
      swift: "CIBEEGCX",
      iban: "EG00",
    },
  });
  assert.equal(result.ready, false);
  assert.ok(result.missing.some((m) => m.code === "relationship_description"));
});

test("legal docs are warnings only and never blockers", () => {
  const result = computePaymentReadiness({
    bank: {
      beneficiary_name: "Ada",
      relationship_type: "parent",
      bank_name: "CIB",
      currency: "EGP",
      swift: "CIBEEGCX",
      account_number: "99",
    },
    documentTypes: [],
  });
  assert.equal(result.ready, true);
  assert.ok(result.warnings.length > 0);
  assert.equal(
    result.missing.some((m) => m.label.toLowerCase().includes("passport")),
    false
  );
});

test("resolvePaymentBankAccount prefers verified default", () => {
  const picked = resolvePaymentBankAccount([
    { id: "a", is_default: true, is_verified: false, bank_name: "A" },
    { id: "b", is_default: true, is_verified: true, bank_name: "B" },
  ]);
  assert.equal(picked?.id, "b");
});
