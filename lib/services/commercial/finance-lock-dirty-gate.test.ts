import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { diffMasterChanges } from "./field-registry";
import type { MasterCommercialValues } from "./types";

/**
 * Mirrors linked-commercial-gate dirty check used before FINANCE_LOCKED.
 * Document date changes must not count as Master commercial dirtiness.
 */
function hasDirtyMasters(
  current: MasterCommercialValues,
  proposed: MasterCommercialValues
): boolean {
  return diffMasterChanges(current, proposed).fieldChanges.length > 0;
}

describe("finance-lock dirty Master gate", () => {
  const baseline: MasterCommercialValues = {
    creator_cost: 1000,
    client_revenue: 1500,
    cost_currency: "AED",
    exchange_rate: 1,
    agency_fee_percent: 10,
    commercial_input_mode: "cost_revenue",
    gp_pct_input: null,
    gp_value_input: 500,
  };

  it("identical Master re-save is not dirty (date-only save path)", () => {
    assert.equal(hasDirtyMasters(baseline, { ...baseline }), false);
  });

  it("cost change is dirty and requires Commercial Revision when locked", () => {
    assert.equal(
      hasDirtyMasters(baseline, { ...baseline, creator_cost: 1100 }),
      true
    );
  });

  it("ignores unknown non-Master keys such as document dates", () => {
    const proposed = {
      ...baseline,
      // @ts-expect-error intentional — dates are not Master keys
      publishing_dates: "2026-09-01",
      validity_date: "2026-12-31",
    } as MasterCommercialValues;
    assert.equal(hasDirtyMasters(baseline, proposed), false);
  });
});
