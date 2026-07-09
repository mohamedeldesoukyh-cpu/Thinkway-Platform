import assert from "node:assert/strict";
import test from "node:test";

import {
  deliverableCommercialDefaults,
  QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE,
} from "./quotation-deliverable-commercial";
import type { QuotationItemRow } from "@/features/quotations/types";

const baseItem = {
  id: "item-1",
  commercial_input_mode: "cost_gp_pct",
  cost_currency: "USD",
  gp_pct: 25,
  af_pct: 10,
} as unknown as QuotationItemRow;

test("deliverableCommercialDefaults uses markup mode regardless of item line mode", () => {
  const defaults = deliverableCommercialDefaults(baseItem);

  assert.equal(defaults.commercial_input_mode, QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE);
  assert.equal(defaults.commercial_input_mode, "cost_markup_pct");
  assert.equal(defaults.cost_currency, "USD");
  assert.equal(defaults.gp_pct, 25);
  assert.equal(defaults.af_pct, 10);
});
