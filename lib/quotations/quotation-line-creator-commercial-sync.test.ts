import assert from "node:assert/strict";
import test from "node:test";

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import {
  deliverablesMatchLineDraft,
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

test("resolveCreatorLinePriceLabel falls back to line Master when deliverable unpriced", () => {
  assert.equal(
    resolveCreatorLinePriceLabel(emptyDeliverable, draft, {
      allowLineMasterFallback: true,
    }),
    "11,200 EGP"
  );
  assert.equal(
    resolveCreatorLinePriceLabel(emptyDeliverable, draft, {
      allowLineMasterFallback: false,
    }),
    "—"
  );
});
