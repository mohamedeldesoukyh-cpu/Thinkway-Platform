import assert from "node:assert/strict";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import {
  aggregateQuotationEngagementRate,
  aggregateQuotationReach,
} from "./quotation-aggregate-metrics";

function mockItem(overrides: Partial<QuotationItemRow> = {}): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: null,
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator A",
    platform: "instagram",
    handle: "@creator",
    followers: 10000,
    engagement_rate: 3,
    country_code: "EG",
    profile_image_url: null,
    profile_url: null,
    deliverables: [],
    option_number: 1,
    service_description: null,
    commercial_input_mode: "cost_gp_pct",
    cost: 1000,
    cost_currency: "EGP",
    revenue: 1333.33,
    gp_pct: 25,
    gp_value: 333.33,
    fx_rate_to_egp: 1,
    cost_egp: 1000,
    revenue_egp: 1333.33,
    gp_value_egp: 333.33,
    af_pct: 10,
    af_value: 133.33,
    af_value_egp: 133.33,
    sort_order: 0,
    ...overrides,
  };
}

{
  const reach = aggregateQuotationReach([
    mockItem({ followers: 1000 }),
    mockItem({ id: "item-2", followers: 2500 }),
  ]);
  assert.equal(reach, 3500);
}

{
  const avgEr = aggregateQuotationEngagementRate([
    mockItem({ influencer_id: "inf-1", engagement_rate: 4, option_number: 1 }),
    mockItem({
      id: "item-2",
      influencer_id: "inf-1",
      engagement_rate: 4,
      option_number: 2,
    }),
    mockItem({ id: "item-3", influencer_id: "inf-2", engagement_rate: 2, option_number: 1 }),
  ]);
  assert.equal(avgEr, 3, "averages per unique creator, not per option line");
}

{
  assert.equal(
    aggregateQuotationEngagementRate([mockItem({ engagement_rate: null })]),
    null
  );
}

console.log("quotation-aggregate-metrics.test.ts passed");
