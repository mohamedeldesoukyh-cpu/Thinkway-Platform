import assert from "node:assert/strict";
import test from "node:test";
import { buildRecognitionEvents } from "./reporting-financials";
import { aggregateCampaignDisplayFinancials } from "@/lib/campaigns/campaign-display-financials";
import { emptyFinancialMetrics } from "@/lib/analytics/metrics/financial";
import { applyFactFilters, rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import type { CampaignAnalyticsFact } from "@/lib/analytics/types/metrics";
import { buildExecutiveDashboardCharts } from "./dashboard-charts";
import { analyticsRequestKey } from "@/lib/analytics/aggregations/memo";

const rates = new Map([["EGP", 1], ["AED", 14], ["USD", 51]]);
const line = { id: "l", campaign_header_id: "c", currency_code: "AED", revenue_before_vat: 1000,
  cost_before_vat: 600, cost_received: 120, cost_received_currency: "USD", usage_rights_amount: 100,
  usage_rights_cost: 20, agency_fee_amount: 110, agency_fee_percent: 10 };
const child = { id: "d", campaign_line_id: "l", quantity: 2, live_date: "2026-09-01",
  revenue_before_vat: 1000, cost_before_vat: 600, usage_rights_amount: 100, usage_rights_cost: 20, agency_fee_amount: 110 };
const posts = [
  { id: "p1", assignment_deliverable_id: "d", status: "posted", live_date: "2026-09-10", revenue_before_vat: 250, cost_before_vat: 120 },
  { id: "p2", assignment_deliverable_id: "d", status: "draft", live_date: "2026-09-11", revenue_before_vat: 750, cost_before_vat: 480 },
];
const input = { lines: [line], deliverables: [child], posts, publications: [], rates,
  campaignCurrencies: new Map([["c", "EGP"]]), today: "2026-10-14" };

test("recognizes only live posts and their equivalent costs with independent revenue/cost currencies", () => {
  const events = buildRecognitionEvents(input);
  assert.equal(events.length, 1);
  assert.equal(events[0].revenue, 4235); // 25% of AED 1,210 converted at 14
  assert.equal(events[0].cost, 1280); // 20% of USD 120 plus 20% of AED 20
  assert.equal(events[0].gp, 2955);
  assert.equal(events[0].date, "2026-09-10");
});

test("approval, past schedule dates, and future live dates do not recognize revenue", () => {
  assert.deepEqual(buildRecognitionEvents({ ...input, posts: posts.map(p => ({ ...p, status: "approved" })) }), []);
  assert.deepEqual(buildRecognitionEvents({ ...input, posts: posts.map(p => ({ ...p, status: "posted", live_date: "2027-01-01" })) }), []);
});

test("a synchronized package recognizes every ad once using its assignment live date", () => {
  const publication = { assignment_deliverable_id: "d", assignment_post_schedule_id: "p2", status: "published", publication_date: "2026-10-01" };
  const events = buildRecognitionEvents({ ...input, posts: posts.map(p => ({...p,status:"posted",live_date:"2026-10-01"})), publications: [publication, publication] });
  assert.equal(events.length, 2);
  assert.equal(events[1].date, "2026-10-01");
  const total = aggregateCampaignDisplayFinancials({ lines: [line], displayCurrency: "EGP", rateToEgpByCurrency: rates });
  assert.equal(events.reduce((n, e) => n + e.revenue, 0), total.revenue);
  assert.equal(events.reduce((n, e) => n + e.gp, 0), total.gp);
});

test("negotiated FX and cent rounding remain consistent after full publication", () => {
  const negotiated = { ...line, revenue_before_vat: 1000.01, revenue_fx_override: JSON.stringify({ from: "AED", to: "EGP", rate: 15, targetRateToEgp: 1 }) };
  const events = buildRecognitionEvents({ ...input, lines: [negotiated], posts: posts.map(p => ({ ...p, status: "posted" })) });
  const total = aggregateCampaignDisplayFinancials({ lines: [negotiated], displayCurrency: "EGP", rateToEgpByCurrency: rates });
  assert.equal(Math.round(events.reduce((n, e) => n + e.revenue, 0) * 100), Math.round(total.revenue * 100));
  assert.equal(Math.round(events.reduce((n, e) => n + e.gp, 0) * 100), Math.round(total.gp * 100));
});

function fact(id: string, revenue: number, billed: number): CampaignAnalyticsFact {
  return { campaign_header_id: id, campaign_name: id, campaign_document_number: id, client_id: "client", client_name: "Client",
    brand_id: null, brand_name: null, team_id: null, team_name: null, country_code: null,
    currency_code: "EGP", source_currency_code: "AED", line_count: 1, period_month: "2026-01",
    metrics: { ...emptyFinancialMetrics(), revenue, achieved_revenue: revenue, invoiced_revenue: billed,
      remaining_to_invoice: Math.max(0, revenue - billed) } };
}
test("unbilled balances sum per campaign instead of netting against another campaign's advance", () => {
  const global = rollupGlobal([fact("a", 100, 0), fact("b", 0, 200)]);
  assert.equal(global.metrics.remaining_to_invoice, 100);
});
test("filters retain source currency and exclude unassigned dimensions", () => {
  assert.equal(applyFactFilters([fact("a", 100, 0)], { currencyCode: "AED" }).length, 1);
  assert.equal(applyFactFilters([fact("a", 100, 0)], { brandIds: ["brand"] }).length, 0);
  assert.equal(applyFactFilters([fact("a", 100, 0)], { countryCodes: ["EG"] }).length, 0);
});
test("revenue and GP trends use actual live month, invoice trend excludes VAT", () => {
  const charts = buildExecutiveDashboardCharts({ facts: [fact("c", 4235, 100)], loaded_at: "now",
    recognition_events: buildRecognitionEvents(input), invoices: [{ id: "i", campaign_header_id: "c", issue_date: "2026-10-01", due_date: null, status: "sent", currency: "EGP", total: 114, amount_paid: 57, revenue_before_vat: 100 }] });
  assert.deepEqual(charts.revenue_trend.map(p => [p.period, p.value]), [["2026-09", 4235]]);
  assert.equal(charts.billing_trend[0].value, 100);
});
test("analytics cache isolates users and every filter", () => {
  const a = {}, b = {};
  assert.notEqual(analyticsRequestKey(a, {}), analyticsRequestKey(b, {}));
  assert.notEqual(analyticsRequestKey(a, {}), analyticsRequestKey(a, { brandIds: ["b"] }));
});


test("reporting reads assignment state rather than interpreting publication statuses independently", () => {
 const publication = {assignment_deliverable_id:"d",assignment_post_schedule_id:"p2",publication_date:"2026-09-10",status:"draft"};
 const base={...input,posts:posts.map(p=>({...p,status:"posted",live_date:"2026-09-10"}))};
 const events=buildRecognitionEvents({...base,publications:[publication]});
 assert.equal(events.length,2);
 assert.equal(events.reduce((n,e)=>n+e.revenue,0),16940);
 assert.deepEqual(events,buildRecognitionEvents({...base,publications:[]}));
});
