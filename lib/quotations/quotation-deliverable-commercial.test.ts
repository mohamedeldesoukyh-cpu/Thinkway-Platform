import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDeliverableClientPrice,
  computeDeliverableTotalClientCost,
  deliverableCommercialDefaults,
  seedDeliverableCommercials,
  formatDeliverablePrice,
  formatDeliverableTotalClientPrice,
  QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE,
  withDeliverableCommercialPatch,
} from "./quotation-deliverable-commercial";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationItemRow } from "@/features/quotations/types";
import { fromDeliverableDrafts } from "./quotation-deliverable-drafts";

const baseItem = {
  id: "item-1",
  commercial_input_mode: "cost_gp_pct",
  cost_currency: "USD",
  gp_pct: 25,
  af_pct: 10,
  cost: 0,
  revenue: 0,
  gp_value: 0,
  deliverables: [],
} as unknown as QuotationItemRow;

const pricedDeliverable = {
  platform: "Instagram",
  type: "Reel",
  quantity: 1,
  cost: 10_000,
  gp_pct: 25,
  commercial_input_mode: "cost_gp_pct",
  cost_currency: "EGP",
} as QuotationDeliverable;

test("deliverableCommercialDefaults uses markup mode regardless of item line mode", () => {
  const defaults = deliverableCommercialDefaults(baseItem);

  assert.equal(defaults.commercial_input_mode, QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE);
  assert.equal(defaults.commercial_input_mode, "cost_markup_pct");
  assert.equal(defaults.cost_currency, "USD");
  assert.equal(defaults.gp_pct, 25);
  assert.equal(defaults.af_pct, 10);
});

test("free_for_client forces zero client price while keeping cost inputs", () => {
  const free = withDeliverableCommercialPatch(
    pricedDeliverable,
    { free_for_client: true },
    1
  );

  assert.equal(free.free_for_client, true);
  assert.equal(free.revenue, 0);
  assert.equal(computeDeliverableClientPrice(free), 0);
  assert.equal(formatDeliverablePrice(free.revenue, "EGP", { freeForClient: true }), "Free");
});

test("deliverable total client cost includes agency fee", () => {
  const withAf = {
    ...pricedDeliverable,
    af_pct: 10,
  };
  assert.equal(computeDeliverableClientPrice(withAf), 13333.33);
  assert.equal(computeDeliverableTotalClientCost(withAf), 14666.66);
  assert.equal(
    formatDeliverableTotalClientPrice(withAf, "EGP"),
    "14,667 EGP"
  );
});

test("clearing free_for_client restores computed client price", () => {
  const restored = withDeliverableCommercialPatch(
    { ...pricedDeliverable, free_for_client: true, revenue: 0 },
    { free_for_client: false },
    1
  );

  assert.equal(restored.free_for_client, false);
  assert.ok((restored.revenue ?? 0) > 0);
});

test("opening unpriced detail uses the displayed master price and preserves mode on edits", () => {
 const seed = seedDeliverableCommercials({platform:"instagram",type:"ig_post",quantity:1}, {cost:65000,revenue:91000,commercial_input_mode:"cost_revenue",af_pct:15,cost_currency:"EGP"});
 const focused = withDeliverableCommercialPatch(seed,{cost:65000},1);
 assert.equal(focused.revenue,91000);
 assert.equal(focused.commercial_input_mode,"cost_revenue");
 const typed = withDeliverableCommercialPatch(focused,{revenue:100000},1);
 assert.equal(computeDeliverableTotalClientCost(typed,1),115000);
 assert.equal(withDeliverableCommercialPatch(typed,{cost:70000},1).revenue,100000);
});

test("manual client cost starts empty and never follows internal cost", () => {
  const derived = withDeliverableCommercialPatch({ platform: "instagram", type: "ig_post", quantity: 1, commercial_input_mode: "cost_markup_pct", gp_pct: 0 }, { cost: 10000 }, 1);
  const manual = withDeliverableCommercialPatch(derived, { commercial_input_mode: "cost_revenue" }, 1);
  assert.equal(manual.revenue, 0);
  assert.equal(withDeliverableCommercialPatch(manual, { cost: 20000 }, 1).revenue, 0);
  const priced = withDeliverableCommercialPatch(manual, { revenue: 25000 }, 1);
  assert.equal(withDeliverableCommercialPatch(priced, { cost: 18000 }, 1).revenue, 25000);
  assert.equal(withDeliverableCommercialPatch(priced, { revenue: 0 }, 1).revenue, 0);
});

test("free toggle preserves the manual price through save/reopen and restores fees", () => {
  const priced: QuotationDeliverable = { platform: "instagram", type: "ig_post", quantity: 1, cost: 65000, revenue: 91000, af_pct: 15, commercial_input_mode: "cost_revenue" };
  const free = withDeliverableCommercialPatch(priced, { free_for_client: true }, 1);
  assert.equal(computeDeliverableTotalClientCost(free), 0);
  assert.equal(free.revenue, 0);
  const [saved] = fromDeliverableDrafts([{ ...JSON.parse(JSON.stringify(free)), key: "line" }]);
  const restored = withDeliverableCommercialPatch(saved, { free_for_client: false }, 1);
  assert.equal(restored.revenue, 91000);
  assert.equal(computeDeliverableTotalClientCost(restored), 104650);
  assert.equal(restored.cost, 65000);
});
