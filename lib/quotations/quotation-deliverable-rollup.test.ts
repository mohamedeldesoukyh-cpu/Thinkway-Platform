import assert from "node:assert/strict";

import {
  deliverableLineCost,
  hasPricedDeliverables,
  rollupDeliverableCommercials,
} from "@/lib/quotations/quotation-deliverable-rollup";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import {
  draftFromQuotationItem,
  resolveQuotationRowDraft,
} from "@/features/quotations/quotation-row-math";
import { computeLiveQuotationTotals } from "@/features/quotations/quotation-row-math";
import type { QuotationItemRow } from "@/features/quotations/types";

function deliverable(overrides: Partial<QuotationDeliverable> = {}): QuotationDeliverable {
  return {
    platform: "instagram",
    type: "ig_post",
    quantity: 1,
    commercial_input_mode: "cost_gp_pct",
    cost: 10000,
    cost_currency: "EGP",
    gp_pct: 25,
    ...overrides,
  };
}

// Deliverable rollup: cost 10k + 25% GP → client 13,333.33
{
  const rolled = rollupDeliverableCommercials([deliverable()], {
    lineCurrency: "EGP",
    fxRateToEgp: 1,
  });
  assert.ok(rolled);
  assert.equal(rolled.cost, 10000);
  assert.ok(rolled.revenue > 13333 && rolled.revenue < 13334);
  assert.ok(rolled.gpValue > 0);
  assert.ok(rolled.gpPct > 24 && rolled.gpPct < 26);
}

// Two deliverable rows sum correctly
{
  const rolled = rollupDeliverableCommercials(
    [
      deliverable({ cost: 5000, gp_pct: 20 }),
      deliverable({ cost: 3000, gp_pct: 10 }),
    ],
    { lineCurrency: "EGP", fxRateToEgp: 1 }
  );
  assert.ok(rolled);
  assert.equal(rolled.cost, 8000);
  assert.ok(rolled.revenue > rolled.cost);
}

// Item draft rolls up priced deliverables (not stale item cost_gp_pct)
{
  const item = {
    id: "item-1",
    commercial_input_mode: "cost_gp_pct",
    cost: 560000,
    cost_currency: "EGP",
    gp_pct: 0,
    revenue: 560000,
    gp_value: 0,
    af_pct: 0,
    fx_rate_to_egp: 1,
    deliverables: [deliverable({ cost: 10000, gp_pct: 25 })],
  } as QuotationItemRow;

  const draft = draftFromQuotationItem(item);
  assert.equal(draft.mode, "cost_revenue");
  assert.equal(draft.cost, 10000);
  assert.ok(draft.revenue > 13333);
  assert.ok(draft.gpPct > 0);
  assert.ok(draft.gpValue > 0);

  const totals = computeLiveQuotationTotals([draft]);
  assert.ok(totals.totalGpValueEgp > 0);
  assert.ok(totals.totalRevenueEgp > totals.totalCostEgp);
}

// resolveQuotationRowDraft prefers live draft edits
{
  const item = {
    id: "item-2",
    commercial_input_mode: "cost_gp_pct",
    cost: 560000,
    cost_currency: "EGP",
    gp_pct: 0,
    revenue: 560000,
    gp_value: 0,
    af_pct: 0,
    fx_rate_to_egp: 1,
    deliverables: [deliverable({ cost: 8000, gp_pct: 20 })],
  } as QuotationItemRow;

  const live = resolveQuotationRowDraft(item, {
    id: "item-2",
    mode: "cost_revenue",
    cost: 12000,
    costCurrency: "EGP",
    gpPct: 0,
    revenue: 15000,
    gpValue: 0,
    afPct: 0,
    fxRateToEgp: 1,
  });
  assert.equal(live.cost, 12000);
  assert.equal(live.revenue, 15000);
}

assert.equal(hasPricedDeliverables([deliverable()]), true);
assert.equal(hasPricedDeliverables([deliverable({ cost: 0, revenue: 0 })]), false);
assert.equal(deliverableLineCost(deliverable({ cost: 5000, quantity: 2 })), 10000);

console.log("quotation-deliverable-rollup.test.ts: all assertions passed");
