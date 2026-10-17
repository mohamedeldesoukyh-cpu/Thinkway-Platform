import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPnLComparisonReport } from "./build-pnl-report";
import { convertPnlFactsToDisplayCurrency } from "./pnl-currency";
import type { PnlLineFact } from "./pnl-report-types";

function fact(patch: Partial<PnlLineFact>): PnlLineFact {
  return {
    client_id: "client-a", client_name: "Client A", brand_id: "brand-a", brand_name: "Brand A",
    group_id: null, group_name: null, period_month: "2026-11", currency_code: "EGP",
    revenue: 100, ur_rev: 20, agency_fees: 10, cost: 60, gp: 75,
    vr_refund: 5, gp_after_vr: 70, vr_rate_percent: 0, ...patch,
  };
}

test("multiple live posts across months count their assignment once in client and brand totals", () => {
  const report = buildPnLComparisonReport([
    fact({ line_id: "line", period_month: "2026-09" }),
    fact({ line_id: "line", period_month: "2026-10" }),
  ], 2026, 2025, "fy", "EGP", ["EGP"]);
  const client = report.client_breakdowns["2026:rev:total"][0];
  assert.equal(client.revenue, 200);
  assert.equal(client.line_count, 1);
  assert.equal(client.brands?.[0].line_count, 1);
});

test("brand subtotals reconcile and remain scoped to client, month, year and selected period", () => {
  const report = buildPnLComparisonReport([
    fact({}), fact({}), fact({ brand_id: "brand-b", brand_name: "Brand B" }),
    fact({ brand_id: null, brand_name: null }),
    fact({ client_id: "client-b", client_name: "Client B" }),
    fact({ period_month: "2026-12" }), fact({ period_month: "2025-11" }),
    fact({ period_month: "2026-01" }),
  ], 2026, 2025, "q4", "EGP", ["EGP"]);
  const clients = report.client_breakdowns["2026:rev:2026-11"];
  const client = clients.find((row) => row.client_id === "client-a")!;
  assert.equal(client.brands?.length, 3);
  assert.equal(client.brands?.find((row) => row.brand_id === "brand-a")?.revenue, 200);
  assert.equal(client.brands?.find((row) => row.brand_id === null)?.brand_name, "Unassigned brand");
  for (const key of ["revenue", "ur_rev", "agency_fees", "billable_revenue", "cost", "gp", "vr_refund", "gp_after_vr", "line_count"] as const) {
    assert.equal(client.brands!.reduce((sum, row) => sum + row[key], 0), client[key], key);
  }
  assert.equal(clients.find((row) => row.client_id === "client-b")?.brands?.[0].revenue, 100);
  assert.equal(report.client_breakdowns["2026:rev:total"].find((row) => row.client_id === "client-a")?.revenue, 500);
  assert.equal(report.client_breakdowns["2025:rev:2025-11"][0].brands?.[0].revenue, 100);
});

test("brand amounts use converted currency and margins are recomputed from totals", async () => {
  const facts = await convertPnlFactsToDisplayCurrency([fact({ currency_code: "USD" })], "EGP", async () => 50);
  const report = buildPnLComparisonReport(facts, 2026, 2025, "fy", "EGP", ["EGP"]);
  const client = report.client_breakdowns["2026:rev:total"][0];
  assert.equal(client.brands?.[0].revenue, 5000);
  assert.equal(client.brands?.[0].brand_id, "brand-a");
  assert.equal(client.brands?.[0].margin_percent, client.margin_percent);
});
