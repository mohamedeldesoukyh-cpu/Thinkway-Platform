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

test("original currency and creator filters change records before totals", () => {
  const source = { ...input, lines: [
    { ...input.lines[0], creators: [{value: "alice", label: "Alice"}], creatorNames: ["Alice"] },
    { ...input.lines[0], id: "l2", currency_code: "EGP", revenue_before_vat: 200, creators: [{value: "bob", label: "Bob"}], creatorNames: ["Bob"] },
  ] };
  assert.deepEqual(buildCustomReport(source, "EGP", "USD").totals.cells.totalRevenue, { EGP: 5000 });
  assert.deepEqual(buildCustomReport(source, "EGP", "", "bob").totals.cells.totalRevenue, { EGP: 200 });
  assert.equal(buildCustomReport(source, "EGP", "USD", "bob").rows.length, 0);
  assert.equal(buildCustomReport(source, "EGP").options.creatorId.length, 2);
});

test("creator detail repeats campaign labels but never duplicates amounts or fixed share", () => {
  const source = { ...input, headers: [{...header, metadata: {revenue_share: {mode: "amount", value: 30, currency: "USD"}}}], lines: [
    { ...input.lines[0], creators: [{value: "alice", label: "Alice"}], creatorNames: ["Alice"] },
    { ...input.lines[0], id: "l2", revenue_before_vat: 200, creators: [{value: "bob", label: "Bob"}], creatorNames: ["Bob"] },
  ] };
  const detail = buildCustomReport(source, "USD", "", "", true);
  const summary = buildCustomReport(source, "USD");
  assert.equal(detail.rows.length, 2);
  assert.equal(detail.campaignCount, 1);
  assert.deepEqual(detail.rows.map(r => r.cells.creator), ["Alice", "Bob"]);
  assert.deepEqual(detail.rows.map(r => r.cells.client), ["Client", "Client"]);
  assert.deepEqual(detail.rows.map(r => r.cells.revenueShare), [{USD: 10}, {USD: 20}]);
  assert.deepEqual(detail.totals.cells, summary.totals.cells);
  const filtered = buildCustomReport(source, "USD", "", "bob", true);
  assert.deepEqual(filtered.totals.cells.revenueShare, {USD: 20});
});

test("Foreign fixed revenue share appears once per campaign and detail preserves currency buckets", () => {
  const source = { ...input, headers: [{...header, metadata: {revenue_share: {mode: "amount", value: 30, currency: "USD"}}}], lines: [
    {...input.lines[0], creatorNames: ["Alice"]}, {...input.lines[0], id: "l2", creatorNames: ["Bob"]},
  ] };
  assert.deepEqual(buildCustomReport(source, "Foreign", "", "", true).totals.cells.revenueShare, {USD: 30});
});

test("marked signing fixtures are excluded from report and browse options", () => {
  const report = buildCustomReport({...input, headers: [{...header, metadata: {signing_test: "PROD-FWD-QA-test"}}]}, "EGP");
  assert.equal(report.rows.length, 0);
  assert.equal(report.options.clientId.length, 0);
  assert.equal(report.options.campaignId.length, 0);
});

test("deliverables and platforms are scoped to creator rows", () => {
  const source = {...input, deliverables: [{id: "d", campaign_line_id: "l", platform: "instagram", deliverable_type: "instagram_reel", quantity: 2, live_date: null, revenue_before_vat: 100, cost_before_vat: 50, usage_rights_amount: 0, usage_rights_cost: 0, agency_fee_amount: 0}]};
  const row = buildCustomReport(source, "EGP", "", "", true).rows[0];
  assert.equal(row.cells.platform, "Instagram");
  assert.equal(row.cells.deliverables, "2 × Instagram reel");
});

test("date fields distinguish planned activity from actual creator live dates", () => {
  const dated = { ...input, headers: [{ ...header, created_at: "2026-01-07T22:30:00Z", document_number: "TW-2026-0012", start_date: "2026-01-01" }], filters: { ...input.filters, asOf: "2026-02-01" },
    lines: [{ ...input.lines[0], creators: [{ value: "a", label: "Alice" }] }, { ...input.lines[0], id: "l2", creators: [{ value: "b", label: "Bob" }] }],
    deliverables: [
      { id: "d1", campaign_line_id: "l", quantity: 1, live_date: "2026-01-10", revenue_before_vat: 100, cost_before_vat: 50, usage_rights_amount: 0, usage_rights_cost: 0, agency_fee_amount: 0, metadata: { workflow_status: "posted", planned_posting_date: "2026-01-08" } },
      { id: "d2", campaign_line_id: "l2", quantity: 1, live_date: "2026-01-20", revenue_before_vat: 100, cost_before_vat: 50, usage_rights_amount: 0, usage_rights_cost: 0, agency_fee_amount: 0, metadata: { workflow_status: "draft", planned_posting_date: "2026-01-20" } },
    ] };
  const rows = buildCustomReport(dated, "EGP", "", "", true).rows;
  assert.equal(rows[0].cells.campaignNumber, "Camp#26-12");
  assert.equal(rows[0].cells.date, "2026-01-01");
  assert.equal(rows[0].cells.wentLive, "Yes");
  assert.equal(rows[0].cells.wentLiveDate, "2026-01-10");
  assert.equal(rows[0].cells.plannedDate, "08 Jan 2026");
  assert.equal(rows[1].cells.wentLive, "No");
  assert.equal(rows[1].cells.wentLiveDate, "—");
  assert.equal(rows[1].cells.plannedDate, "20 Jan 2026");
  const periodInput = { ...dated, filters: { ...dated.filters, from: "2026-01-08", to: "2026-01-10" } };
  assert.equal(buildCustomReport(periodInput, "EGP", "", "", true, "date").rows.length, 0);
  const planned = buildCustomReport(periodInput, "EGP", "", "", true, "plannedDate");
  const live = buildCustomReport(periodInput, "EGP", "", "", true, "wentLiveDate");
  assert.equal(planned.rows.length, 1); assert.equal(live.rows.length, 1);
  assert.equal(planned.rows[0].creatorIdentities?.[0].name, "Alice");
  assert.deepEqual(planned.totals.cells.totalRevenue, planned.rows[0].cells.totalRevenue);
  assert.equal(planned.campaignCount, 1);
  assert.equal(planned.period?.basis, "plannedDate");
  assert.equal(buildCustomReport(periodInput, "EGP", "", "", true, "enteredDate").rows.length, 2);
  const throughToday = buildCustomReport({ ...dated, filters: { ...dated.filters, from: "2026-01-01", to: "" } }, "EGP");
  assert.match(throughToday.period?.to || "", /^\d{4}-\d{2}-\d{2}$/);
  assert.ok((throughToday.period?.to || "") >= "2026-01-01");
});

test("multiple campaign and creator selections form unions within each filter", () => {
  const report = buildCustomReport({ ...input, headers: [header, { ...header, id: "c2" }, { ...header, id: "c3" }],
    lines: [
      { ...input.lines[0], creators: [{ value: "a", label: "Alice" }] },
      { ...input.lines[0], id: "l2", campaign_header_id: "c2", creators: [{ value: "b", label: "Bob" }] },
      { ...input.lines[0], id: "l3", campaign_header_id: "c3", creators: [{ value: "c", label: "Carol" }] },
    ], filters: { ...input.filters, campaignId: "c,c2" } }, "EGP", "", "a,b", true);
  assert.equal(report.rows.length, 2);
  assert.equal(report.campaignCount, 2);
  assert.deepEqual(report.totals.cells.totalRevenue, { EGP: 10000 });
  assert.deepEqual(report.rows.flatMap(r => r.creatorIdentities?.map(c => c.name)), ["Alice", "Bob"]);
});
