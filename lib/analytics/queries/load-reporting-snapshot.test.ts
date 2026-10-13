import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadReportingSnapshot, readReportingRows } from "./load-reporting-snapshot";
import { rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";

function database(failPayments = false) {
  const tables: Record<string, object[]> = {
    campaign_headers: [
      { id: "a", name: "A", document_number: "A", status: "active", client_id: "client", brand_id: "brand", client: { name: "Client", country: "EG" }, brand: { name: "Brand" }, currency_code: "EGP", start_date: "2026-01-01" },
      { id: "cancelled", status: "cancelled", currency_code: "EGP" },
    ],
    campaign_lines: [{ id: "line", campaign_header_id: "a", currency_code: "AED", cost_received_currency: "USD", revenue_before_vat: 1000, cost_received: 100, cost_before_vat: 600 }],
    assignment_deliverables: [{ id: "d", campaign_line_id: "line", quantity: 2, revenue_before_vat: 1000, cost_before_vat: 600 }],
    assignment_post_schedule: [
      { id: "p1", assignment_deliverable_id: "d", status: "posted", live_date: "2026-09-01", revenue_before_vat: 500, cost_before_vat: 300 },
      { id: "p2", assignment_deliverable_id: "d", status: "posted", live_date: "2026-10-01", revenue_before_vat: 500, cost_before_vat: 300 },
    ],
    campaign_publications: [],
    campaign_influencers: [{ id: "vendor", campaign_header_id: "a", currency: "USD", cost_after_vat: 114, vendor_payment_status: "partial" }],
    creator_payment_entries: [
      { assignment_id: "vendor", status: "paid", cleared_at: null, original_amount: 40 },
      { assignment_id: "vendor", status: "paid", cleared_at: "2026-09-20", original_amount: 20 },
      { assignment_id: "vendor", status: "exported", cleared_at: null, original_amount: 10 },
    ],
    invoices: [
      { id: "i", campaign_header_id: "a", currency: "AED", status: "sent", issue_date: "2026-09-02", total: 570, revenue_before_vat: 500, amount_paid: 200 },
      { id: "void", campaign_header_id: "a", currency: "AED", status: "void", issue_date: "2026-09-02", total: 99999 },
      { id: "replaced", campaign_header_id: "a", currency: "AED", status: "sent", regeneration_status: "regenerated", issue_date: "2026-09-02", total: 99999 },
      { id: "draft", campaign_header_id: "a", currency: "AED", status: "draft", issue_date: null, total: 99999 },
    ],
    campaign_fx_po_totals: [{ campaign_header_id: "a", po_amount: 15000, po_consumed: 14000 }],
  };
  return {
    from(table: string) {
      const result = () => ({ data: tables[table] ?? [], error: failPayments && table === "creator_payment_entries" ? { message: "unavailable" } : null });
      const query = { select() { return query; }, order() { return query; },
        range: async (from: number, to: number) => ({ ...result(), data: result().data.slice(from, to + 1) }),
        in: async () => result() };
      return query;
    },
    rpc: async (_name: string, args: { p_from_currency: string }) => ({ data: args.p_from_currency === "AED" ? 14 : 50, error: null }),
  } as unknown as SupabaseClient;
}
test("full snapshot reconciles currency, recognized GP, active invoices, payments and authoritative PO", async () => {
  const snapshot = await loadReportingSnapshot(database(), {});
  assert.equal(snapshot.facts.length, 1);
  assert.equal(snapshot.invoices.length, 1);
  const m = rollupGlobal(snapshot.facts).metrics;
  assert.equal(m.revenue, 14000);
  assert.equal(m.cost, 5000);
  assert.equal(m.gp, 9000);
  assert.equal(m.invoiced_revenue, 7000);
  assert.equal(m.collected_revenue, 2800);
  assert.equal(m.outstanding_revenue, 5180);
  assert.equal(m.vendor_payable, 3700);
  assert.equal(m.remaining_to_invoice, 7000);
  assert.equal(m.budget_amount, 15000);
  assert.equal(m.actual_amount, 14000);
});
test("date range uses live date for profit and issue date for invoices; current balances stay current", async () => {
  const snapshot = await loadReportingSnapshot(database(), { dateRange: { from: "2026-10-01", to: "2026-10-14" } });
  const m = snapshot.facts[0].metrics;
  assert.equal(m.revenue, 7000);
  assert.equal(m.cost, 2500);
  assert.equal(m.invoiced_revenue, 0);
  assert.equal(m.outstanding_revenue, 5180);
  assert.equal(snapshot.recognition_events?.length, 1);
});
test("brand filter scopes KPIs, invoices, charts and balances together", async () => {
  const snapshot = await loadReportingSnapshot(database(), { brandIds: ["other"] });
  assert.deepEqual(snapshot.facts, []);
  assert.deepEqual(snapshot.invoices, []);
  assert.deepEqual(snapshot.recognition_events, []);
});
test("unavailable financial sources fail instead of publishing zero payables", async () => {
  await assert.rejects(loadReportingSnapshot(database(true), {}), /unavailable/);
});
test("pagination reads beyond backend default row limits", async () => {
  const rows = Array.from({ length: 1250 }, (_, id) => ({ id }));
  assert.equal((await readReportingRows({ range: async (a, b) => ({ data: rows.slice(a, b + 1), error: null }) })).length, 1250);
});
