import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDeliverableClientPrice,
  computeDeliverableTotalClientCost,
  deliverableCommercialDefaults,
  formatDeliverablePrice,
  formatDeliverableTotalClientPrice,
  QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE,
  withDeliverableCommercialPatch,
} from "./quotation-deliverable-commercial";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationItemRow } from "@/features/quotations/types";

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
