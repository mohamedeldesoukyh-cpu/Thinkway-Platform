import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCurrencyAmount,
  formatMoneyDetail,
  formatMoneyKpi,
} from "./currency-format";

describe("Financial Display Standard — formatCurrencyAmount", () => {
  it("formats detail precision with ISO code and two decimals", () => {
    assert.equal(formatMoneyDetail(1_235_561, "EGP"), "EGP 1,235,561.00");
    assert.equal(formatMoneyDetail(928_085.25, "AED"), "AED 928,085.25");
    assert.equal(formatMoneyDetail(150_000, "USD"), "USD 150,000.00");
    assert.equal(formatMoneyDetail(90_000, "EUR"), "EUR 90,000.00");
    assert.equal(formatMoneyDetail(75_000, "GBP"), "GBP 75,000.00");
    assert.equal(formatMoneyDetail(120_000, "SAR"), "SAR 120,000.00");
  });

  it("formats KPI precision with ISO code and no decimals", () => {
    assert.equal(formatMoneyKpi(1_235_561.49, "EGP"), "EGP 1,235,561");
    assert.equal(formatMoneyKpi(928_085.75, "AED"), "AED 928,086");
    assert.equal(
      formatCurrencyAmount(450_000.2, "USD", { precision: "kpi" }),
      "USD 450,000"
    );
  });

  it("never emits localized currency symbols", () => {
    const samples = [
      formatMoneyDetail(1000, "USD"),
      formatMoneyDetail(1000, "EGP"),
      formatMoneyDetail(1000, "GBP"),
      formatMoneyDetail(1000, "EUR"),
      formatMoneyKpi(1000, "USD"),
    ];
    for (const sample of samples) {
      assert.doesNotMatch(sample, /[$£€]|E£|د\.إ|﷼/);
      assert.match(sample, /^[A-Z]{3} /);
    }
  });

  it("normalizes blank currency to platform default ISO code", () => {
    const formatted = formatMoneyDetail(10, "  ");
    assert.match(formatted, /^[A-Z]{3} 10\.00$/);
  });
});
