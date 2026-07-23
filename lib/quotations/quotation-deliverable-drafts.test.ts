import assert from "node:assert/strict";

import { fromDeliverableDrafts } from "@/lib/quotations/quotation-deliverable-drafts";
import { rollupDeliverableCommercials } from "@/lib/quotations/quotation-deliverable-rollup";

{
  const pricedWithoutType = fromDeliverableDrafts([
    {
      key: "d-1",
      platform: "instagram",
      type: "",
      types: [],
      type_lines: [{ type: "", quantity: 1 }],
      quantity: 1,
      cost: 35000,
      cost_currency: "EGP",
      revenue: 45500,
      gp_pct: 23.08,
      af_pct: 10,
      commercial_input_mode: "cost_revenue",
      free_for_client: false,
      service_description: null,
    },
  ]);

  assert.equal(
    pricedWithoutType.length,
    1,
    "priced deliverables must survive without a type so header totals can calculate"
  );

  const rolled = rollupDeliverableCommercials(pricedWithoutType, {
    lineCurrency: "EGP",
    fxRateToEgp: 1,
    lineAfPct: 10,
  });
  assert.ok(rolled);
  assert.ok(rolled!.cost > 0);
  assert.ok(rolled!.revenue > 0);
}

{
  const empty = fromDeliverableDrafts([
    {
      key: "d-2",
      platform: "instagram",
      type: "",
      types: [],
      type_lines: [{ type: "", quantity: 1 }],
      quantity: 1,
      cost: 0,
      cost_currency: "EGP",
      revenue: null,
      gp_pct: 25,
      af_pct: 10,
      commercial_input_mode: "cost_markup_pct",
      free_for_client: false,
      service_description: null,
    },
  ]);
  assert.equal(empty.length, 0, "blank unpriced rows stay filtered out");
}

console.log("quotation-deliverable-drafts.test.ts passed");
