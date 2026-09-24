import assert from "node:assert/strict";
import test from "node:test";
import { payableCurrencyTotals } from "./currency-totals";

test("54 mixed-currency payables remain separate, including rows beyond 30", () => {
  const rows = [
    ...Array.from({ length: 41 }, () => ({ currency: "EGP", agreed_fee: 1000, status: "pending" as const })),
    ...Array.from({ length: 7 }, () => ({ currency: "USD", agreed_fee: 100, status: "pending" as const })),
    ...Array.from({ length: 6 }, () => ({ currency: "AED", agreed_fee: 200, status: "pending" as const })),
  ];
  assert.deepEqual(payableCurrencyTotals(rows), [
    { currency: "AED", pending: 1200, paid: 0, pendingCount: 6, paidCount: 0 },
    { currency: "EGP", pending: 41000, paid: 0, pendingCount: 41, paidCount: 0 },
    { currency: "USD", pending: 700, paid: 0, pendingCount: 7, paidCount: 0 },
  ]);
});

test("paid amounts are separated and decimals round within each currency", () => {
  assert.deepEqual(payableCurrencyTotals([
    { currency: " usd ", agreed_fee: 0.1, status: "pending" },
    { currency: "USD", agreed_fee: 0.2, status: "pending" },
    { currency: "USD", agreed_fee: 15, status: "paid" },
    { currency: "EGP", agreed_fee: 100, status: "paid" },
  ]), [
    { currency: "EGP", pending: 0, paid: 100, pendingCount: 0, paidCount: 1 },
    { currency: "USD", pending: 0.3, paid: 15, pendingCount: 2, paidCount: 1 },
  ]);
});

test("empty and unknown currencies never default to USD", () => {
  assert.deepEqual(payableCurrencyTotals([]), []);
  assert.equal(payableCurrencyTotals([{ currency: "", agreed_fee: 12, status: "pending" }])[0].currency, "Unspecified currency");
});
