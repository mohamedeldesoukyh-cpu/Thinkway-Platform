import assert from "node:assert/strict";
import { test } from "node:test";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { buildQuotationConvertUnits } from "@/lib/domains/commercial/quotation-convert-selection";
import { buildQuotationConvertSnapshotHash } from "@/lib/domains/commercial/quotation-convert-snapshot";

function item(partial: Partial<QuotationItemRow> & { id: string }): QuotationItemRow {
  return {
    id: partial.id,
    influencer_id: "inf-1",
    profile_id: null,
    unified_id: "u1",
    source_shortlist_item_id: null,
    creator_name: "Creator",
    platform: "instagram",
    handle: "@c",
    followers: 1,
    engagement_rate: 1,
    country_code: "EG",
    profile_image_url: null,
    profile_url: null,
    deliverables: [{ platform: "instagram", type: "reel", quantity: 1 }],
    commercial_input_mode: "cost_revenue",
    cost: partial.cost ?? 100,
    cost_currency: "EGP",
    revenue: partial.revenue ?? 200,
    gp_pct: 50,
    gp_value: 100,
    fx_rate_to_egp: 1,
    cost_egp: 100,
    revenue_egp: 200,
    gp_value_egp: 100,
    af_pct: 10,
    af_value: 20,
    af_value_egp: 20,
    option_number: partial.option_number ?? 1,
    service_description: null,
    collapse_group_id: partial.collapse_group_id ?? null,
    collapse_label: null,
    sort_order: partial.sort_order ?? 1,
  };
}

test("snapshot hash is stable for identical commercial inputs", () => {
  const units = buildQuotationConvertUnits([item({ id: "a", revenue: 500, cost: 200 })]);
  const a = buildQuotationConvertSnapshotHash({
    quotationId: "q1",
    serialNumber: "QT-2026-0001",
    versionNumber: 1,
    currency: "EGP",
    totalRevenueEgp: 500,
    totalCostEgp: 200,
    units,
  });
  const b = buildQuotationConvertSnapshotHash({
    quotationId: "q1",
    serialNumber: "QT-2026-0001",
    versionNumber: 1,
    currency: "EGP",
    totalRevenueEgp: 500,
    totalCostEgp: 200,
    units,
  });
  assert.equal(a, b);
  assert.equal(a.length, 64);
});

test("snapshot hash changes when revenue changes", () => {
  const unitsA = buildQuotationConvertUnits([item({ id: "a", revenue: 500 })]);
  const unitsB = buildQuotationConvertUnits([item({ id: "a", revenue: 600 })]);
  const a = buildQuotationConvertSnapshotHash({
    quotationId: "q1",
    serialNumber: "QT-2026-0001",
    versionNumber: 1,
    currency: "EGP",
    totalRevenueEgp: 500,
    totalCostEgp: 200,
    units: unitsA,
  });
  const b = buildQuotationConvertSnapshotHash({
    quotationId: "q1",
    serialNumber: "QT-2026-0001",
    versionNumber: 1,
    currency: "EGP",
    totalRevenueEgp: 600,
    totalCostEgp: 200,
    units: unitsB,
  });
  assert.notEqual(a, b);
});
