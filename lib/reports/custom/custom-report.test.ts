import assert from "node:assert/strict";
import test from "node:test";
import { buildCustomReport } from "./custom-report";
import { parseOverviewFilters, type OverviewHeader } from "../overview/overview-report";

const header: OverviewHeader = { id: "c", name: "Campaign", status: "active", start_date: null, currency_code: "USD", client_id: "client", brand_id: null, client: { name: "Client", group_id: null, agency_or_direct: null, group: null }, brand: null };
const input = { headers: [header], lines: [{ id: "l", campaign_header_id: "c", currency_code: "USD", cost_received_currency: "AED", revenue_before_vat: 100, cost_received: 50, revenue_vat_amount: 14 }], rates: new Map([["EGP", 1], ["USD", 50], ["AED", 14], ["SAR", 13]]), deliverables: [], posts: [], publications: [], filters: parseOverviewFilters({}) };
test("display currencies convert both sides and VAT without changing net profit", () => {
  for (const currency of ["EGP", "USD", "AED", "SAR"] as const) {
    const row = buildCustomReport(input, currency).rows[0];
    const rate = input.rates.get(currency)!;
    assert.deepEqual(row.cells.totalRevenue, { [currency]: Math.round(5000 / rate * 100) / 100 });
    assert.deepEqual(row.cells.totalCost, { [currency]: Math.round(700 / rate * 100) / 100 });
    assert.deepEqual(row.cells.vat, { [currency]: Math.round(700 / rate * 100) / 100 });
  }
});
test("Foreign keeps each side in its original currency and never subtracts unlike currencies", () => {
  const report = buildCustomReport(input, "Foreign");
  assert.deepEqual(report.rows[0].cells.totalRevenue, { USD: 100 });
  assert.deepEqual(report.rows[0].cells.totalCost, { AED: 50 });
  assert.deepEqual(report.rows[0].cells.vat, { USD: 14 });
  assert.equal(report.rows[0].cells.totalGp, null);
  assert.equal(report.totals.cells.totalGp, null);
});
test("Foreign preserves original amounts despite negotiated conversion overrides", () => {
  const source = { ...input, lines: [{ ...input.lines[0], cost_received_currency: "USD", revenue_fx_override: JSON.stringify({ from: "USD", to: "EGP", rate: 60, targetRateToEgp: 1 }) }] };
  assert.deepEqual(buildCustomReport(source, "Foreign").rows[0].cells.totalGp, { USD: 50 });
  assert.deepEqual(buildCustomReport(source, "EGP").rows[0].cells.vat, { EGP: 840 });
});
test("Foreign totals retain separate currency buckets", () => {
  const source = { ...input, headers: [header, { ...header, id: "other" }], lines: [input.lines[0], { ...input.lines[0], id: "other", campaign_header_id: "other", currency_code: "SAR" }] };
  assert.deepEqual(buildCustomReport(source, "Foreign").totals.cells.totalRevenue, { USD: 100, SAR: 100 });
});
