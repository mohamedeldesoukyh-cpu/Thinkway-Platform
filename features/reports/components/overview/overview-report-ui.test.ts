import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_OVERVIEW_COLUMNS, OVERVIEW_COLUMNS, orderOverviewColumns, type OverviewColumn, type OverviewFilters, type OverviewReport } from "@/lib/reports/overview/overview-report";

import {
  amountTone,
  countAdvancedFilters,
  formatOverviewAmount,
  formatOverviewDate,
  hasUnappliedFilterChanges,
  moveOverviewColumn,
  OVERVIEW_COLUMN_META,
  overviewFilterChips,
  overviewFilterSearchParams,
  overviewHeaderGroups,
  stepOverviewColumn,
  withFilterChange,
} from "./overview-report-ui";

const ALL = OVERVIEW_COLUMNS.map(column => column.key) as OverviewColumn[];
const filters: OverviewFilters = {
  q: "", groupId: "", clientId: "", brandId: "", campaignId: "", status: "", from: "", to: "",
  asOf: "2026-11-13", currency: "EGP", activity: "", clientType: "", columns: [...DEFAULT_OVERVIEW_COLUMNS],
};
const options: OverviewReport["options"] = {
  groupId: [{ value: "g1", label: "Group One" }],
  clientId: [{ value: "c1", label: "Client One" }],
  brandId: [{ value: "b1", label: "Brand One" }],
  campaignId: [{ value: "k1", label: "Campaign One" }],
  status: [{ value: "active", label: "active" }],
  currency: [{ value: "EGP", label: "EGP" }],
};

test("column metadata keeps every key and the concise headings from the report definition", () => {
  assert.deepEqual(Object.keys(OVERVIEW_COLUMN_META).sort(), [...ALL].sort());
  for (const column of OVERVIEW_COLUMNS) assert.equal(OVERVIEW_COLUMN_META[column.key].label, column.label);
  assert.equal(OVERVIEW_COLUMN_META.accruedRevenue.kind, "accrued");
  assert.equal(OVERVIEW_COLUMN_META.totalGp.kind, "total");
  assert.equal(OVERVIEW_COLUMN_META.revenueShare.kind, "share");
  assert.equal(OVERVIEW_COLUMN_META.gpAfterShare.kind, "afterShare");
  assert.equal(OVERVIEW_COLUMN_META.revenue.kind, "actual");
  assert.equal(OVERVIEW_COLUMN_META.campaign.kind, "text");
});

test("header groups span consecutive columns of the same family", () => {
  assert.deepEqual(
    overviewHeaderGroups(ALL).map(group => [group.label, group.span]),
    [["Campaign", 4], ["Revenue", 3], ["Cost", 3], ["Gross profit", 3], ["Revenue share", 2]],
  );
  assert.deepEqual(overviewHeaderGroups(["gp", "campaign", "cost"]).map(group => group.label), ["Gross profit", "Campaign", "Cost"]);
});

test("moves go through orderOverviewColumns; totals cannot leave their group", () => {
  const order = orderOverviewColumns(ALL);
  assert.equal(moveOverviewColumn(order, order.indexOf("totalRevenue"), 0), order);
  assert.equal(stepOverviewColumn(order, "totalRevenue", -1), order);
  assert.equal(stepOverviewColumn(order, "gpAfterShare", -1), order);
  const campaignFirst = stepOverviewColumn(stepOverviewColumn(stepOverviewColumn(order, "campaign", -1), "campaign", -1), "campaign", -1);
  assert.equal(campaignFirst[0], "campaign");
  assert.deepEqual(orderOverviewColumns(campaignFirst), campaignFirst);
  // A one-place move that would snap back keeps stepping until the order changes.
  const costUp = stepOverviewColumn(order, "cost", -1);
  assert.notEqual(costUp, order);
  assert.ok(costUp.indexOf("cost") < order.indexOf("cost"));
  assert.deepEqual(orderOverviewColumns(costUp), costUp);
  assert.equal(stepOverviewColumn(order, "group", -1), order);
});

test("amounts keep cents, grouping and a true minus sign without negative zero", () => {
  assert.equal(formatOverviewAmount(1234567890.5), "1,234,567,890.50");
  assert.equal(formatOverviewAmount(-20000), "−20,000.00");
  assert.equal(formatOverviewAmount(-0.001), "0.00");
  assert.equal(formatOverviewAmount(0), "0.00");
  assert.equal(amountTone(-1), "negative");
  assert.equal(amountTone(0), "zero");
  assert.equal(amountTone(-0.004), "zero");
  assert.equal(amountTone(10), "default");
});

test("dates format for display and ignore invalid input", () => {
  assert.equal(formatOverviewDate("2026-11-13"), "13 Nov 2026");
  assert.equal(formatOverviewDate(""), "");
  assert.equal(formatOverviewDate("13/11/2026"), "");
});

test("filter cascade matches the previous select behavior", () => {
  const full = { ...filters, groupId: "g1", clientId: "c1", brandId: "b1", campaignId: "k1" };
  assert.deepEqual(
    [withFilterChange(full, "groupId", "g2")].map(f => [f.groupId, f.clientId, f.brandId, f.campaignId])[0],
    ["g2", "", "", ""],
  );
  assert.deepEqual([withFilterChange(full, "clientId", "")].map(f => [f.groupId, f.clientId, f.brandId, f.campaignId])[0], ["g1", "", "", ""]);
  assert.deepEqual([withFilterChange(full, "brandId", "b2")].map(f => [f.clientId, f.brandId, f.campaignId])[0], ["c1", "b2", ""]);
  assert.equal(withFilterChange(full, "status", "active").campaignId, "k1");
});

test("search params keep the previous URL shape: non-empty filters then visible columns", () => {
  const params = overviewFilterSearchParams({ ...filters, q: "nile", clientType: "agency" }, ["campaign", "gp"]);
  assert.equal(params.toString(), "q=nile&asOf=2026-11-13&currency=EGP&clientType=agency&columns=campaign%2Cgp");
});

test("chips describe applied filters with option labels; currency and as-of are not chips", () => {
  const chips = overviewFilterChips({ ...filters, groupId: "g1", status: "active", from: "2026-01-01", activity: "both", q: "x" }, options);
  assert.deepEqual(chips.map(chip => `${chip.label}=${chip.value}`), [
    "Search=“x”", "Group=Group One", "Status=Active", "Activity=Actual and accrued", "Start from=1 Jan 2026",
  ]);
  assert.equal(countAdvancedFilters({ ...filters, status: "active", to: "2026-02-01", currency: "USD" }), 2);
});

test("unapplied changes ignore column state", () => {
  assert.equal(hasUnappliedFilterChanges(filters, { ...filters, columns: ["gp"] }), false);
  assert.equal(hasUnappliedFilterChanges({ ...filters, q: "a" }, filters), true);
});

test("date presets are calendar-correct and ranges format compactly", async () => {
  const { overviewDatePresets, formatOverviewDateRange, changedFilterKeys } = await import("./overview-report-ui");
  const presets = Object.fromEntries(overviewDatePresets("2026-01-15").map(p => [p.id, `${p.from}..${p.to}`]));
  assert.equal(presets["this-month"], "2026-01-01..2026-01-31");
  assert.equal(presets["last-month"], "2025-12-01..2025-12-31");
  assert.equal(presets["this-quarter"], "2026-01-01..2026-03-31");
  assert.equal(presets["last-quarter"], "2025-10-01..2025-12-31");
  assert.equal(presets.ytd, "2026-01-01..2026-01-15");
  assert.equal(presets["last-year"], "2025-01-01..2025-12-31");
  assert.equal(overviewDatePresets("2024-03-10").find(p => p.id === "last-month")?.to, "2024-02-29");
  assert.equal(formatOverviewDateRange("2026-07-01", "2026-09-30"), "1 Jul – 30 Sep 2026");
  assert.equal(formatOverviewDateRange("2025-12-01", "2026-01-31"), "1 Dec 2025 – 31 Jan 2026");
  assert.equal(formatOverviewDateRange("2026-07-01", ""), "From 1 Jul 2026");
  assert.equal(formatOverviewDateRange("", "2026-07-01"), "Until 1 Jul 2026");
  assert.deepEqual(changedFilterKeys({ ...filters, groupId: "g1", q: "x", columns: ["gp"] }, filters), ["q", "groupId"]);
});
