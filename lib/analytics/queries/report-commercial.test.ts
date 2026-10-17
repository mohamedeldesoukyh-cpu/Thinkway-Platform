import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveReportCommercial } from "./report-commercial";
import { buildRecognitionEvents } from "./reporting-financials";

const rates = new Map([["EGP", 1], ["AED", 14], ["USD", 51]]);
const line = { id: "line", campaign_header_id: "campaign", status: "active", currency_code: "AED",
  revenue_before_vat: 1000, cost_before_vat: 600, cost_received: 100, cost_received_currency: "USD",
  revenue_fx_override: JSON.stringify({ from: "AED", to: "EGP", rate: 15, targetRateToEgp: 1 }),
  cost_fx_override: JSON.stringify({ from: "USD", to: "EGP", rate: 50, targetRateToEgp: 1 }) };

test("detailed reports include negotiated revenue FX and independent vendor FX in GP", () => {
  assert.deepEqual(resolveReportCommercial(line, rates), { revenue: 15000, ur_rev: 0, agency_fees: 0, cost: 5000, gp: 10000 });
  assert.equal(resolveReportCommercial({ ...line, currency_code: null }, rates, "AED").revenue, 15000);
  assert.throws(() => resolveReportCommercial(line, new Map()), /Missing FX rate/);
});

test("recognized revenue components reconcile including UR, agency fees and FX rounding", () => {
  const priced = { ...line, revenue_before_vat: 1000.01, usage_rights_amount: 100.03, agency_fee_amount: 110.07, usage_rights_cost: 20 };
  const events = buildRecognitionEvents({ lines: [priced], rates, today: "2026-10-18", campaignCurrencies: new Map(), publications: [],
    deliverables: [{ id: "d", campaign_line_id: "line", quantity: 3, live_date: "2026-09-01", revenue_before_vat: 1000.01,
      cost_before_vat: 600, usage_rights_amount: 100.03, usage_rights_cost: 20, agency_fee_amount: 110.07,
      metadata: { workflow_status: "posted" } }], posts: [] });
  const commercial = resolveReportCommercial(priced, rates);
  const cents = (n: number) => Math.round(n * 100);
  for (const event of events) assert.equal(cents(event.revenue), cents(event.base_revenue! + event.ur_rev! + event.agency_fees!));
  assert.equal(cents(events.reduce((n, e) => n + e.gp, 0)), cents(commercial.gp));
  assert.equal(cents(events.reduce((n, e) => n + e.base_revenue!, 0)), cents(commercial.revenue));
});

test("P&L recognizes only live portions in live month; other reports retain booked scope with FX", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-only";
  const { loadPnLLineFacts } = await import("./pnl-report");
  const tables: Record<string, Record<string, unknown>[]> = {
    campaign_headers: [{ id: "campaign", status: "active", currency_code: "AED", start_date: "2026-01-01",
      client: { id: "client", name: "Client" }, brand: { id: "brand", name: "Brand" } }],
    campaign_lines: [line, { ...line, id: "cancelled", status: "cancelled", metadata: { went_live: true, went_live_date: "2026-09-01" } }],
    assignment_deliverables: [{ id: "d", campaign_line_id: "line", quantity: 2, revenue_before_vat: 1000, cost_before_vat: 600 }],
    assignment_post_schedule: [
      { id: "p1", assignment_deliverable_id: "d", status: "posted", live_date: "2026-09-01", revenue_before_vat: 500, cost_before_vat: 300 },
      { id: "p2", assignment_deliverable_id: "d", status: "approved", live_date: "2026-09-02", revenue_before_vat: 500, cost_before_vat: 300 },
    ],
  };
  const db = { from(table: string) {
    let rows = tables[table] ?? [];
    const query = { select() { return query; }, order() { return query; },
      in(key: string, values: unknown[]) { rows = rows.filter(r => values.includes(r[key])); return query; },
      range: async (a: number, b: number) => ({ data: rows.slice(a, b + 1), error: null }) };
    return query;
  }, rpc: async (_name: string, args: { p_from_currency: string }) => ({ data: rates.get(args.p_from_currency), error: null }) } as unknown as SupabaseClient;
  const facts = await loadPnLLineFacts(db, { liveOnly: true });
  assert.equal(facts.length, 1);
  assert.equal(facts[0].period_month, "2026-09");
  assert.equal(facts[0].revenue, 7500);
  assert.equal(facts[0].cost, 2500);
  assert.equal(facts[0].gp, 5000);
  assert.equal(facts[0].brand_id, "brand");
  assert.equal(facts[0].currency_code, "EGP");
  const booked = await loadPnLLineFacts(db);
  assert.equal(booked[0].revenue, 15000);
  assert.equal(booked[0].gp, 10000);
  assert.equal(booked[0].period_month, "2026-01");
  tables.assignment_post_schedule[0].live_date = "2099-01-01";
  assert.deepEqual(await loadPnLLineFacts(db, { liveOnly: true }), []);
});
