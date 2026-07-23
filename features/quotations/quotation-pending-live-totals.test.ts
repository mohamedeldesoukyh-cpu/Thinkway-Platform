import assert from "node:assert/strict";

import { fromEgp } from "@/lib/commercial/fx-aggregation";
import {
  applyPendingToQuotationItem,
  resolveLiveTotalsDraft,
} from "@/features/quotations/quotation-pending-live-totals";
import {
  computeLiveQuotationTotals,
  draftFromQuotationItem,
} from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";

function mockItem(overrides: Partial<QuotationItemRow> = {}): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: "inf-1",
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
    cost: 0,
    cost_currency: "EGP",
    revenue: 0,
    gp_pct: 25,
    gp_value: 0,
    fx_rate_to_egp: 1,
    cost_egp: 0,
    revenue_egp: 0,
    gp_value_egp: 0,
    af_pct: 10,
    af_value: 0,
    af_value_egp: 0,
    sort_order: 0,
    ...overrides,
  };
}

{
  assert.equal(fromEgp(1000, "EGP", 1), 1000);
  assert.equal(fromEgp(1000, "SAR", 10), 100);
}

{
  const item = mockItem();
  const pending = {
    deliverables: [
      {
        platform: "instagram",
        type: "instagram_reel",
        quantity: 1,
        cost: 5000,
        cost_currency: "EGP",
        revenue: 7000,
        gp_pct: 28.57,
        af_pct: 10,
      },
    ],
  };
  const merged = applyPendingToQuotationItem(item, pending);
  assert.equal(merged.deliverables?.length, 1);

  const draft = resolveLiveTotalsDraft(item, draftFromQuotationItem(item), pending);
  const totals = computeLiveQuotationTotals([draft]);
  assert.ok(totals.totalCostEgp > 0, "pending deliverable cost should feed live totals");
  assert.ok(totals.totalRevenueEgp > 0, "pending deliverable revenue should feed live totals");
}

{
  const item = mockItem();
  const liveDraft = {
    ...draftFromQuotationItem(item),
    mode: "cost_revenue" as const,
    cost: 40000,
    revenue: 45500,
    gpValue: 5500,
    gpPct: 12.09,
  };
  // Empty pending rollup must not wipe the live draft amounts.
  const draft = resolveLiveTotalsDraft(item, liveDraft, {
    deliverables: [],
    cost: 0,
    revenue: 0,
  });
  const totals = computeLiveQuotationTotals([draft]);
  assert.equal(totals.totalCostEgp, 40000);
  assert.equal(totals.totalRevenueEgp, 45500);
}

console.log("quotation-pending-live-totals.test.ts passed");
