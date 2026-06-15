import assert from "node:assert/strict";

import { resolveLinePoBillableBase } from "@/lib/finance/po/billable-base";
import {
  resolveOperationalPo,
  resolveWorkspacePoAlert,
} from "@/lib/finance/po/operational-budget";

// Arab Bank-style case: Rev 515k + UR/AF components → 566.5k billable base
const arabBankLine = {
  revenue_before_vat: 515_000,
  usage_rights_amount: 20_000,
  agency_fee_amount: 31_500,
};

assert.equal(
  resolveLinePoBillableBase(arabBankLine),
  566_500,
  "billable base includes UR Rev and AF"
);

const operational = resolveOperationalPo({
  po_amount_campaign_currency: 566_500,
  po_consumed_amount: 566_500,
  po_remaining_amount: 0,
  po_remaining_percent: 0,
  legacy_budget: 0,
  legacy_consumed: 0,
});

assert.equal(operational.po_consumed, 566_500);
assert.equal(operational.po_remaining, 0);
assert.equal(operational.po_exceeded, false);

const legacyOperational = resolveOperationalPo({
  po_amount_campaign_currency: null,
  legacy_budget: 566_500,
  legacy_consumed: 566_500,
});

assert.equal(legacyOperational.po_consumed, 566_500);
assert.equal(legacyOperational.uses_governance, false);

const alert = resolveWorkspacePoAlert({ operational });
assert.equal(alert.po_banner_consumed, operational.po_consumed);
assert.equal(alert.po_exceeded, operational.po_exceeded);

const revenueOnlyConsumed = resolveOperationalPo({
  po_amount_campaign_currency: 566_500,
  po_consumed_amount: 515_000,
  legacy_budget: 0,
  legacy_consumed: 0,
});

assert.equal(
  revenueOnlyConsumed.po_remaining,
  51_500,
  "old revenue-only consumption understates utilization"
);

console.log("operational-budget.test.ts: ok");
