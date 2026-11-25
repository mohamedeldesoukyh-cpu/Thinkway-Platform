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

// Deliverable rollup includes agency fee from deliverable AF%
{
  const rolled = rollupDeliverableCommercials(
    [deliverable({ cost: 10000, gp_pct: 25, af_pct: 10 })],
    { lineCurrency: "EGP", fxRateToEgp: 1 }
  );
  assert.ok(rolled);
  assert.ok(rolled.revenue > 13333 && rolled.revenue < 13334);
  assert.ok(rolled.afValue > 1333 && rolled.afValue < 1334);
  assert.equal(rolled.afPct, 10);
  assert.ok(rolled.totalClientCost > rolled.revenue);
}

// Item draft uses line Master SSOT — priced deliverables do not override remount
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
  assert.equal(draft.mode, "cost_gp_pct");
  assert.equal(draft.cost, 560000);
  assert.equal(draft.revenue, 560000);
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
assert.equal(
  hasPricedDeliverables([deliverable({ cost: 0, revenue: 0, free_for_client: true })]),
  true
);
assert.equal(deliverableLineCost(deliverable({ cost: 5000, quantity: 2 })), 10000);

console.log("quotation-deliverable-rollup.test.ts: all assertions passed");

// Keep the selected calculation method through edits, aggregation and save inputs.
for (const mode of ["cost_markup_pct", "cost_gp_pct", "cost_gp_value", "cost_revenue"] as const) {
  for (const cost of [60000, 65000, 70000]) {
    const d = deliverable({ commercial_input_mode: mode, cost, gp_pct: 40, gp_value: 26000, revenue: 91000 });
    const rolled = rollupDeliverableCommercials([d], { lineCurrency: "EGP", fxRateToEgp: 1 })!;
    assert.equal(rolled.mode, mode);
    assert.equal(rolled.gpPctInput, 40);
    if (mode === "cost_revenue") assert.equal(rolled.revenue, 91000);
    if (mode === "cost_markup_pct") assert.equal(rolled.revenue, cost * 1.4);
    if (mode === "cost_gp_value") assert.equal(rolled.gpValueInput, 26000);
    const reopened = rollupDeliverableCommercials(JSON.parse(JSON.stringify([d])), { lineCurrency: "EGP", fxRateToEgp: 1 })!;
    assert.equal(reopened.mode, mode);
  }
}
assert.equal(rollupDeliverableCommercials([deliverable(), deliverable({commercial_input_mode:"cost_markup_pct"})], {lineCurrency:"EGP",fxRateToEgp:1})!.mode,"cost_revenue");
