import { strict as assert } from "node:assert";
import { test } from "node:test";

import { outputsDependingOn } from "./output-catalog";

/**
 * The platform's smart-dependency-graph rules, asserted at the catalog level so
 * they hold regardless of which generators are wired.
 */

test("creators change → Strategy, Media Plan, Timeline, Proposal, Budget Allocation are affected", () => {
  const affected = new Set(outputsDependingOn("creators"));
  for (const kind of [
    "full_strategy",
    "media_plan",
    "posting_timeline",
    "executive_proposal",
    "budget_allocation",
  ] as const) {
    assert.ok(affected.has(kind), `expected creators to affect ${kind}`);
  }
  // KPI Forecast is intentionally NOT driven by creators.
  assert.ok(!affected.has("kpi_forecast"));
});

test("budget change → Strategy, Budget Allocation, KPI Forecast, Proposal are affected", () => {
  const affected = new Set(outputsDependingOn("budget"));
  for (const kind of [
    "full_strategy",
    "budget_allocation",
    "kpi_forecast",
    "executive_proposal",
  ] as const) {
    assert.ok(affected.has(kind), `expected budget to affect ${kind}`);
  }
});

test("kpis change → ONLY KPI Forecast and Proposal are affected (exclusivity)", () => {
  const affected = outputsDependingOn("kpis").sort();
  assert.deepEqual(affected.sort(), ["executive_proposal", "kpi_forecast"].sort());
});
