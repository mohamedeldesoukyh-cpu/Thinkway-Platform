import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assignmentCommercialMastersChanged,
  recomputeAgencyFeeAmount,
} from "@/lib/assignments/assignment-commercial-masters";

test("assignmentCommercialMastersChanged treats AF% like client revenue", () => {
  const base = {
    revenue_before_vat: 100_000,
    cost_before_vat: 50_000,
    agency_fee_percent: 10,
    usage_rights_amount: 0,
    usage_rights_cost: 0,
  };

  assert.equal(
    assignmentCommercialMastersChanged(base, { ...base, agency_fee_percent: 12 }),
    true
  );
  assert.equal(
    assignmentCommercialMastersChanged(base, { ...base, revenue_before_vat: 110_000 }),
    true
  );
  assert.equal(
    assignmentCommercialMastersChanged(base, { ...base, usage_rights_amount: 5_000 }),
    true
  );
  assert.equal(assignmentCommercialMastersChanged(base, { ...base }), false);
});

test("recomputeAgencyFeeAmount scales with client revenue at fixed AF%", () => {
  assert.equal(
    recomputeAgencyFeeAmount({
      revenueBeforeVat: 100_000,
      usageRightsAmount: 10_000,
      agencyFeePercent: 5,
    }),
    5_500
  );
  assert.equal(
    recomputeAgencyFeeAmount({
      revenueBeforeVat: 200_000,
      usageRightsAmount: 10_000,
      agencyFeePercent: 5,
    }),
    10_500
  );
});
