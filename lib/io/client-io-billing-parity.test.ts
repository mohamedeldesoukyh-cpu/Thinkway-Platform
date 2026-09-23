import assert from "node:assert/strict";
import { test } from "node:test";
import { assignmentClientBilling } from "@/lib/assignments/client-billing-commercial";
import { creatorFxAmount, makeCreatorFx } from "@/lib/commercial/creator-fx";
import { resolveVendorIoLineAmount } from "./vendor-io-line-amount";

test("Camp 2026-5 selected six and all seven have consistent fees, VAT and custom FX", () => {
  const entries = [1000, 1100, 1000, 500, 900, 1000, 1500].map((amount, i) => ({
    id: String(i), currency_code: i === 3 ? "USD" : "AED", revenue_before_vat: amount,
    agency_fee_amount: amount / 10, agency_fee_percent: 10, revenue_vat_percent: 14,
    revenue_fx_override: i === 3 ? makeCreatorFx("USD", "EGP", 55, 1) : null,
  }));
  const totals = entries.map(line => creatorFxAmount(assignmentClientBilling(line).totalBilling, {
    from: line.currency_code, to: "EGP", sourceRateToEgp: line.currency_code === "USD" ? 52.2151 : 15.5,
    targetRateToEgp: 1, override: line.revenue_fx_override,
  }));
  assert.equal(totals.slice(0, 6).reduce((a,b) => a+b, 0), 131670);
  assert.equal(totals.reduce((a,b) => a+b, 0), 160825.5);
  assert.equal(assignmentClientBilling(entries[0]).totalBilling, 1254);
});

test("creator IO fee remains the original USD or AED cost, independent of reporting FX", () => {
  for (const currency_code of ["USD", "AED"]) {
    const line = { cost_before_vat: 500, revenue_before_vat: 800, currency_code,
      cost_fx_override: makeCreatorFx(currency_code, "EGP", 55, 1), revenue_fx_override: makeCreatorFx(currency_code, "EGP", 60, 1) };
    assert.equal(resolveVendorIoLineAmount(line), 500);
    assert.equal(line.currency_code, currency_code);
  }
});
