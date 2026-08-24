/**
 * Regression: Commercial Workspace line Save must keep Master SSOT across
 * remount, Preview/PDF/PPTX document build, and Campaign Generate seeds.
 *
 * Scenario: edit line commercials → persist line Master + strip deliverable
 * commercials → remount drafts from line → export + generate use same numbers.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { mapQuotationItemsToExecutionLineSeeds } from "@/lib/domains/commercial/quotation-execution-mapper";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { draftToLinePending } from "@/lib/quotations/commercial-workspace/stage-pending";
import { hasPricedDeliverables } from "@/lib/quotations/quotation-deliverable-rollup";
import {
  deliverablesPatchForLineMasterSave,
  resolveQuotationDeliverablesWrite,
  shouldPreferDeliverableRollup,
  stripDeliverableCommercialAmounts,
} from "@/lib/quotations/quotation-line-commercial-ssot";
import { applyCommercialWorkspaceBulkOp } from "@/lib/quotations/commercial-workspace/bulk-transforms";
import { rollupDeliverableCommercials } from "@/lib/quotations/quotation-deliverable-rollup";
import { linePendingDiffersFromItem } from "@/lib/quotations/quotation-line-pending-diff";
import {
  computeLiveQuotationTotals,
  draftFromQuotationItem,
  draftsFromItems,
  type QuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import { buildQuotationDocument } from "@/features/quotations/export/quotation-document";
import type { QuotationDetail, QuotationItemRow } from "@/features/quotations/types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

function pricedDeliverable(cost: number): QuotationDeliverable {
  return {
    platform: "instagram",
    type: "ig_reel",
    quantity: 1,
    cost,
    revenue: cost * 1.3,
    gp_pct: 23,
    gp_value: cost * 0.3,
    af_pct: 0,
    commercial_input_mode: "cost_revenue",
    cost_currency: "EGP",
  };
}

function itemWithStaleDeliverables(
  overrides: Partial<QuotationItemRow> = {}
): QuotationItemRow {
  return {
    id: "qi-tuna-1",
    influencer_id: "inf-1",
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator",
    platform: "instagram",
    handle: "@creator",
    followers: 10000,
    engagement_rate: 3,
    country_code: "EG",
    profile_image_url: null,
    profile_url: null,
    deliverables: [pricedDeliverable(20000)],
    option_number: 1,
    service_description: null,
    commercial_input_mode: "cost_revenue",
    cost: 20000,
    cost_currency: "EGP",
    revenue: 26000,
    gp_pct: 23.08,
    gp_value: 6000,
    fx_rate_to_egp: 1,
    cost_egp: 20000,
    revenue_egp: 26000,
    gp_value_egp: 6000,
    af_pct: 0,
    af_value: 0,
    af_value_egp: 0,
    sort_order: 0,
    ...overrides,
  };
}

/** Simulate atomic line-Master Save (service clears priced deliverables). */
function persistLineMasterSave(
  item: QuotationItemRow,
  draft: QuotationRowDraft
): QuotationItemRow {
  const cleared =
    deliverablesPatchForLineMasterSave(item.deliverables) ??
    stripDeliverableCommercialAmounts(item.deliverables ?? []);
  const cost = draft.cost;
  const revenue = draft.revenue;
  const gpValue = draft.gpValue;
  return {
    ...item,
    commercial_input_mode: draft.mode,
    cost,
    cost_currency: draft.costCurrency,
    revenue,
    gp_pct: draft.gpPct,
    gp_value: gpValue,
    af_pct: draft.afPct,
    cost_egp: cost * draft.fxRateToEgp,
    revenue_egp: revenue * draft.fxRateToEgp,
    gp_value_egp: gpValue * draft.fxRateToEgp,
    deliverables: cleared,
  };
}

test("edit → save → remount keeps Master; deliverables cannot override", () => {
  const before = itemWithStaleDeliverables();
  assert.equal(hasPricedDeliverables(before.deliverables), true);

  const edited: QuotationRowDraft = {
    ...draftFromQuotationItem(before),
    cost: 21000,
    revenue: 27300,
    gpValue: 6300,
    gpPct: 23.08,
  };
  const pending = draftToLinePending(edited, before.deliverables);
  assert.equal(linePendingDiffersFromItem(before, pending), true);
  assert.equal(hasPricedDeliverables(pending.deliverables), false);

  const afterSave = persistLineMasterSave(before, edited);
  assert.equal(afterSave.cost, 21000);
  assert.equal(afterSave.revenue, 27300);
  assert.equal(hasPricedDeliverables(afterSave.deliverables), false);

  const remountDrafts = draftsFromItems([afterSave]);
  assert.equal(remountDrafts[afterSave.id]!.cost, 21000);
  assert.equal(remountDrafts[afterSave.id]!.revenue, 27300);

  // Poisoned remount: stale priced deliverables must not override line Master
  const poisoned = {
    ...afterSave,
    deliverables: [pricedDeliverable(20000)],
  };
  assert.equal(draftFromQuotationItem(poisoned).cost, 21000);
});

test("downstream Preview document + Campaign Generate match saved Master", () => {
  const saved = persistLineMasterSave(itemWithStaleDeliverables(), {
    id: "qi-tuna-1",
    mode: "cost_revenue",
    cost: 21000,
    costCurrency: "EGP",
    gpPct: 23.08,
    revenue: 27300,
    gpValue: 6300,
    afPct: 0,
    fxRateToEgp: 1,
  });

  const detail = {
    id: "q-1",
    serial_number: "QT-2026-0009-V2",
    name: "TUNA",
    campaign_name: "TUNA",
    status: "draft",
    currency: "EGP",
    total_cost_egp: 21000,
    total_revenue_egp: 27300,
    total_gp_value_egp: 6300,
    total_gp_pct: 23.08,
    total_af_egp: 0,
    total_agency_margin_egp: 0,
    gp_target_pct: null,
    validity_date: null,
    issue_date: "2026-01-01",
    is_expired: false,
    version: "v1.0",
    department: null,
    prepared_by_name: null,
    reviewed_by_name: null,
    approved_at: null,
    owner_name: null,
    client_name: "Client",
    brand_name: "Brand",
    client_signature_name: null,
    notes: null,
    terms: null,
    revisions: [],
    items: [saved],
  } as unknown as QuotationDetail;

  const doc = buildQuotationDocument(detail, {
    template: "detailed",
    audience: "internal",
    itemIds: [saved.id],
  });
  const row = doc.creatorGroups[0]?.rows[0];
  assert.ok(row);
  assert.match(row!.unitCost ?? "", /21[,.]?000/);
  assert.match(row!.clientCost, /27[,.]?300/);
  assert.match(doc.summary.totalCost ?? "", /21[,.]?000/);
  assert.match(doc.summary.totalClientCost, /27[,.]?300/);

  const workspaceTotals = computeLiveQuotationTotals([
    draftFromQuotationItem(saved),
  ]);
  assert.equal(workspaceTotals.totalCostEgp, 21000);
  assert.equal(workspaceTotals.totalRevenueEgp, 27300);

  const creator = {
    influencer_id: "inf-1",
    unified_id: "uc-1",
    display_name: "Creator",
    platforms: [
      {
        id: "acc-1",
        platform: "instagram",
        handle: "@creator",
        profile_url: "https://instagram.com/creator",
        follower_count: 10000,
        engagement_rate: 3,
        audience_country: "EG",
      },
    ],
  } as unknown as UnifiedCreatorResult;

  const seeds = mapQuotationItemsToExecutionLineSeeds({
    items: [
      {
        id: saved.id,
        influencer_id: "inf-1",
        unified_id: null,
        creator_name: "Creator",
        platform: "instagram",
        handle: "@creator",
        option_number: 1,
        cost: saved.cost,
        revenue: saved.revenue,
        cost_currency: saved.cost_currency,
        deliverables: saved.deliverables,
      },
    ],
    creators: [creator],
    influencerIdByCreatorId: new Map([["inf-1", "inf-1"]]),
    defaultCurrency: "EGP",
  });
  assert.equal(seeds.length, 1);
  assert.equal(seeds[0]!.cost, 21000);
  assert.equal(seeds[0]!.revenue, 27300);
});

test("cost-detail save keeps unit cost when rollup must not replace Master", () => {
  const incoming = [
    {
      platform: "instagram",
      type: "ig_reel",
      quantity: 1,
      cost: 5000,
      revenue: null,
      gp_pct: null,
      gp_value: null,
      af_pct: null,
      commercial_input_mode: "cost_revenue" as const,
      cost_currency: "EGP",
    },
  ];
  const rolled = rollupDeliverableCommercials(incoming, {
    lineCurrency: "EGP",
    fxRateToEgp: 1,
  });
  assert.ok(rolled);
  assert.equal(rolled!.cost, 5000);
  assert.equal(rolled!.revenue, 0);
  assert.equal(
    shouldPreferDeliverableRollup({
      rolled,
      masterRevenue: 12_500,
    }),
    false
  );
  const persisted = resolveQuotationDeliverablesWrite({ incoming });
  assert.equal(persisted?.[0]!.cost, 5000);
  assert.equal(persisted?.[0]!.commercial_input_mode, "cost_revenue");
});

test("markup then cost-only deliverable flush must not wipe Master revenue", () => {
  const before = itemWithStaleDeliverables({
    cost: 1000,
    revenue: 0,
    gp_pct: 0,
    gp_value: 0,
    cost_currency: "USD",
    fx_rate_to_egp: 50,
    cost_egp: 50_000,
    revenue_egp: 0,
    gp_value_egp: 0,
    deliverables: [
      {
        platform: "instagram",
        type: "ig_reel",
        quantity: 1,
        cost: 1000,
        revenue: null,
        gp_pct: null,
        gp_value: null,
        af_pct: null,
        commercial_input_mode: "cost_revenue",
        cost_currency: "USD",
      },
    ],
  });

  const markedUp = applyCommercialWorkspaceBulkOp(draftFromQuotationItem(before), {
    kind: "apply_markup_pct",
    pct: 25,
  });
  assert.equal(markedUp.mode, "cost_revenue");
  assert.equal(markedUp.revenue, 1250);

  const costOnlyRollup = rollupDeliverableCommercials(before.deliverables, {
    lineCurrency: "USD",
    fxRateToEgp: 50,
  });
  assert.ok(costOnlyRollup);
  assert.equal(costOnlyRollup!.cost, 1000);
  assert.equal(costOnlyRollup!.revenue, 0);

  assert.equal(
    shouldPreferDeliverableRollup({
      rolled: costOnlyRollup,
      masterRevenue: markedUp.revenue,
    }),
    false
  );

  const afterSave = persistLineMasterSave(before, markedUp);
  assert.equal(afterSave.cost, 1000);
  assert.equal(afterSave.revenue, 1250);
  assert.equal(afterSave.cost_egp, 50_000);
  assert.equal(afterSave.revenue_egp, 62_500);

  const live = computeLiveQuotationTotals([draftFromQuotationItem(afterSave)]);
  assert.equal(live.totalCostEgp, 50_000);
  assert.equal(live.totalRevenueEgp, 62_500);
});
