import assert from "node:assert/strict";

import { resolveLinePoBillableBase } from "@/lib/finance/po/billable-base";

assert.equal(
  resolveLinePoBillableBase({
    revenue_before_vat: 100_000,
    usage_rights_amount: 10_000,
    agency_fee_percent: 5,
  }),
  115_500
);

assert.equal(
  resolveLinePoBillableBase({
    revenue_before_vat: 100_000,
    usage_rights_amount: 10_000,
    agency_fee_amount: 7_500,
  }),
  117_500,
  "stored agency fee amount takes precedence"
);

console.log("billable-base.test.ts: ok");
