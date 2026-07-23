import assert from "node:assert/strict";
import { test } from "node:test";

import type { QuotationItemRow } from "@/features/quotations/types";
import {
  deliverablePricingCompleteness,
  maxPricingCompleteness,
  quotationDisplayGroupPricingCompleteness,
  quotationCreatorCardPricingClass,
  rowDraftPricingCompleteness,
} from "@/lib/quotations/quotation-creator-group-pricing";

const baseDeliverable = {
  key: "d-0",
  platform: "instagram",
  type: "instagram_reel",
  quantity: 1,
  cost: 0,
  revenue: null,
  commercial_input_mode: "cost_markup_pct" as const,
  gp_pct: 0,
};

const baseItem = {
  id: "item-1",
  fx_rate_to_egp: 1,
  cost: 0,
  revenue: null,
  deliverables: [baseDeliverable],
} as unknown as QuotationItemRow;

test("deliverablePricingCompleteness is red state when neither value is set", () => {
  assert.equal(deliverablePricingCompleteness(baseDeliverable), "none");
});

test("deliverablePricingCompleteness is orange when only unit cost is set", () => {
  assert.equal(
    deliverablePricingCompleteness({
      ...baseDeliverable,
      commercial_input_mode: "cost_revenue",
      cost: 1500,
      revenue: null,
    }),
    "partial"
  );
});

test("deliverablePricingCompleteness is green when both unit and client cost exist", () => {
  assert.equal(
    deliverablePricingCompleteness({
      ...baseDeliverable,
      cost: 1500,
      gp_pct: 20,
    }),
    "complete"
  );
});

test("rowDraftPricingCompleteness uses rolled-up row draft totals", () => {
  assert.equal(rowDraftPricingCompleteness(baseItem), "none");
  assert.equal(
    rowDraftPricingCompleteness(baseItem, {
      id: "item-1",
      mode: "cost_revenue",
      cost: 50000,
      costCurrency: "EGP",
      gpPct: 0,
      revenue: 68000,
      gpValue: 18000,
      afPct: 0,
      fxRateToEgp: 1,
    }),
    "complete"
  );
});

test("maxPricingCompleteness prefers the furthest pricing state", () => {
  assert.equal(maxPricingCompleteness("none", "partial", "complete"), "complete");
  assert.equal(maxPricingCompleteness("none", "partial"), "partial");
});

test("quotationCreatorCardPricingClass maps completeness to card classes", () => {
  assert.equal(quotationCreatorCardPricingClass("none"), "quotation-creator-card--missing-cost");
  assert.equal(quotationCreatorCardPricingClass("partial"), "quotation-creator-card--orange");
  assert.equal(quotationCreatorCardPricingClass("complete"), "quotation-creator-card--green");
});

test("quotationDisplayGroupPricingCompleteness uses pending deliverables and row drafts", () => {
  const group = {
    kind: "creator" as const,
    creatorKey: "creator-a",
    items: [baseItem],
  };

  assert.equal(quotationDisplayGroupPricingCompleteness(group), "none");
  assert.equal(
    quotationDisplayGroupPricingCompleteness(
      group,
      () => ({
        deliverables: [{ ...baseDeliverable, cost: 1000, gp_pct: 15 }],
      }),
      undefined
    ),
    "complete"
  );
  assert.equal(
    quotationDisplayGroupPricingCompleteness(group, undefined, {
      "item-1": {
        id: "item-1",
        mode: "cost_revenue",
        cost: 50000,
        costCurrency: "EGP",
        gpPct: 26.5,
        revenue: 68000,
        gpValue: 18000,
        afPct: 0,
        fxRateToEgp: 1,
      },
    }),
    "complete"
  );
});
