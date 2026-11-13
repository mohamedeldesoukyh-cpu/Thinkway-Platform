import assert from "node:assert/strict";
import test from "node:test";
import { Workbook } from "exceljs";
import { buildOverviewReport, parseOverviewFilters, type OverviewHeader } from "./overview-report";
import { buildOverviewReportHtml, buildOverviewReportExcelBuffer } from "../document/overview-report-document";

const header: OverviewHeader = { id: "c", name: "Campaign <one>", status: "active", start_date: "2026-01-01", currency_code: "EGP", client_id: "client", brand_id: "brand", client: { name: "Client", group_id: "group", agency_or_direct: "agency", group: { name: "Group" } }, brand: { name: "Brand" } };
const line = { id: "l", campaign_header_id: "c", currency_code: "EGP", revenue_before_vat: 1000, cost_before_vat: 600, usage_rights_amount: 100, usage_rights_cost: 40, agency_fee_amount: 110 };
const input = {
  headers: [header], lines: [line], rates: new Map([["EGP",1],["USD",50]]),
  deliverables: [{ id: "d", campaign_line_id: "l", quantity: 2, live_date: null, revenue_before_vat: 1000, cost_before_vat: 600, usage_rights_amount: 100, usage_rights_cost: 40, agency_fee_amount: 110 }],
  posts: [{ id: "p1", assignment_deliverable_id: "d", status: "posted", live_date: "2026-03-01", revenue_before_vat: 250, cost_before_vat: 150 }, { id: "p2", assignment_deliverable_id: "d", status: "draft", live_date: "2026-03-02", revenue_before_vat: 750, cost_before_vat: 450 }],
  publications: [], filters: parseOverviewFilters({}, "2026-11-13"),
};
test("partial publication separates actual and accrued including fees and usage-rights costs", () => {
  const { rows: [r], totals } = buildOverviewReport(input);
  assert.equal(r.revenue, 302.5); assert.equal(r.cost, 160); assert.equal(r.gp, 142.5);
  assert.equal(r.accruedRevenue, 907.5); assert.equal(r.accruedCost, 480); assert.equal(r.accruedGp, 427.5);
  assert.equal(r.totalRevenue, 1210); assert.equal(r.totalCost, 640); assert.equal(r.totalGp, 570);
  assert.equal(totals.totalGp, 570);
});
test("no deliverables remain entirely accrued and full publication clears accruals", () => {
  assert.equal(buildOverviewReport({ ...input, deliverables: [] }).rows[0].accruedRevenue, 1210);
  const r = buildOverviewReport({ ...input, posts: input.posts.map(p => ({ ...p, status: "posted" })) }).rows[0];
  assert.equal(r.accruedRevenue, 0); assert.equal(r.accruedCost, 0); assert.equal(r.accruedGp, 0);
});
test("as-of date and currency preserve partition identities", () => {
  const early = buildOverviewReport({ ...input, filters: { ...input.filters, asOf: "2026-02-01" } }).rows[0];
  assert.equal(early.revenue, 0); assert.equal(early.accruedRevenue, 1210);
  const r = buildOverviewReport({ ...input, filters: { ...input.filters, currency: "USD" } }).rows[0];
  assert.equal(r.totalRevenue, 24.2); assert.equal(r.totalCost, 12.8);
  assert.equal(Math.round((r.revenue + r.accruedRevenue) * 100), Math.round(r.totalRevenue * 100));
});
test("filters and cancellation apply before totals", () => {
  for (const patch of [{ groupId: "other" }, { clientId: "other" }, { brandId: "other" }, { campaignId: "other" }, { status: "completed" }, { clientType: "direct" }, { from: "2026-02-01" }, { to: "2025-12-01" }, { q: "missing" }]) {
    const report = buildOverviewReport({ ...input, filters: { ...input.filters, ...patch } });
    assert.equal(report.rows.length, 0); assert.equal(report.totals.totalRevenue, 0);
  }
  assert.equal(buildOverviewReport({ ...input, headers: [{ ...header, status: "cancelled" }] }).rows.length, 0);
  assert.equal(buildOverviewReport({ ...input, filters: { ...input.filters, activity: "both", q: "client" } }).rows.length, 1);
});
test("column parsing and invalid dates have safe defaults", () => {
  const f = parseOverviewFilters({ columns: "gp,invalid,gp,campaign", asOf: "2099-01-01", from: "2026-02-30" }, "2026-11-13");
  assert.deepEqual(f.columns, ["gp", "campaign"]); assert.equal(f.asOf, "2026-11-13"); assert.equal(f.from, "");
});
test("exports follow selected columns, escape labels and shade accrual header/data/totals", async () => {
  const report = buildOverviewReport({ ...input, filters: { ...input.filters, columns: ["campaign", "accruedRevenue", "totalGp"] } });
  const html = buildOverviewReportHtml(report);
  assert.match(html, /Campaign &lt;one&gt;/); assert.doesNotMatch(html, /<th[^>]*>Client Name/);
  const book = new Workbook();
  await book.xlsx.load(await buildOverviewReportExcelBuffer(report));
  const sheet = book.worksheets[0];
  let headerRow = 0;
  sheet.eachRow((r, i) => { if (r.getCell(1).value === "Campaign Name") headerRow = i; });
  assert.ok(headerRow > 0); assert.equal(sheet.getCell(headerRow, 2).value, "Acc. Rev.");
  assert.equal(sheet.getCell(headerRow + 1, 2).value, 907.5);
  assert.equal(sheet.getCell(headerRow + 2, 3).value, 570);
  for (const i of [headerRow, headerRow + 1, headerRow + 2]) assert.equal(sheet.getCell(i, 2).fill.type, "pattern");
});
