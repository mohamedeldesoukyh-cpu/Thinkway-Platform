import assert from "node:assert/strict";
import test from "node:test";

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import {
  deliverablesMatchLineDraft,
  formatEgpTotalInDisplayCurrency,
  projectLineDraftOntoDeliverables,
  resolveCreatorLinePriceLabel,
} from "@/lib/quotations/quotation-line-creator-commercial-sync";
import { hasPricedDeliverables } from "@/lib/quotations/quotation-deliverable-rollup";

const draft: QuotationRowDraft = {
  id: "qi-1",
  mode: "cost_revenue",
  cost: 10_000,
  costCurrency: "EGP",
  gpPct: 10.714,
  revenue: 11_200,
  gpValue: 1_200,
  afPct: 0,
  fxRateToEgp: 1,
};

const emptyDeliverable: QuotationDeliverable = {
  platform: "instagram",
  type: "ig_reel",
  quantity: 1,
  cost: null,
  revenue: null,
  gp_pct: null,
  gp_value: null,
  af_pct: null,
  cost_currency: "EGP",
};

test("projectLineDraftOntoDeliverables puts Master on first row and clears others", () => {
  const projected = projectLineDraftOntoDeliverables(
    [
      emptyDeliverable,
      { ...emptyDeliverable, type: "ig_story", cost: 5000, revenue: 6000 },
    ],
    draft
  );

  assert.equal(projected[0]!.cost, 10_000);
  assert.equal(projected[0]!.revenue, 11_200);
  assert.equal(projected[1]!.cost, null);
  assert.equal(projected[1]!.revenue, null);
  assert.equal(hasPricedDeliverables(projected), true);
  assert.equal(deliverablesMatchLineDraft(projected, draft), true);
});

test("resolveCreatorLinePriceLabel prefers Master and display currency", () => {
  assert.equal(
    resolveCreatorLinePriceLabel(emptyDeliverable, draft, {
      allowLineMasterFallback: true,
      preferLineMaster: true,
      displayCurrency: "EGP",
      displayFxRateToEgp: 1,
    }),
    "11,200 EGP"
  );

  // Stale deliverable amounts must not win over Master when preferLineMaster.
  const stale: QuotationDeliverable = {
    ...emptyDeliverable,
    cost: 50_000,
    revenue: 60_000,
    commercial_input_mode: "cost_revenue",
    cost_currency: "EGP",
  };
  assert.equal(
    resolveCreatorLinePriceLabel(stale, draft, {
      preferLineMaster: true,
      displayCurrency: "EGP",
      displayFxRateToEgp: 1,
    }),
    "11,200 EGP"
  );

  // EGP master → USD display (fx 52).
  assert.equal(
    resolveCreatorLinePriceLabel(emptyDeliverable, draft, {
      preferLineMaster: true,
      displayCurrency: "USD",
      displayFxRateToEgp: 52,
    }),
    "215 USD"
  );
});

test("formatEgpTotalInDisplayCurrency matches header conversion", () => {
  assert.equal(formatEgpTotalInDisplayCurrency(589_648, "EGP", 1), "589,648 EGP");
  assert.equal(formatEgpTotalInDisplayCurrency(589_648, "USD", 52), "11,339 USD");
});
