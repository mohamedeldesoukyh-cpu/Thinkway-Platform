import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRecognizedCampaignKpis } from "./campaign-portfolio-kpis";
import type { CampaignAnalyticsFact } from "@/lib/analytics/types/metrics";
import { emptyFinancialMetrics } from "@/lib/analytics/metrics/financial";

test("Campaigns uses the recognized EGP book, weighted margin, and all linked assignments", () => {
  const facts = [
    { campaign_header_id: "aed", source_currency_code: "AED", metrics: { ...emptyFinancialMetrics(), revenue: 14000, gp: 3500, planned_revenue: 28000 } },
    { campaign_header_id: "egp", source_currency_code: "EGP", metrics: { ...emptyFinancialMetrics(), revenue: 6000, gp: 600, planned_revenue: 100000 } },
  ] as CampaignAnalyticsFact[];
  const assignments = Array.from({length: 1205}, (_, i) => ({id: String(i), campaign_header_id: "aed", influencer_id: "creator"}));
  assert.deepEqual(aggregateRecognizedCampaignKpis(facts, [...assignments,
    {id: "cancelled", campaign_header_id: "cancelled", influencer_id: "creator"},
    {id: "unlinked", campaign_header_id: null, influencer_id: "creator"}]), {
    total_campaigns: 2, total_revenue: 20000, avg_margin: 20.5, assignments: 1205, currency_code: "EGP",
  });
});
