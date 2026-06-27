import assert from "node:assert/strict";

import {
  deliverableStatusTimestamps,
  emptyToNull,
  escapeIlikePattern,
  resolveAssignmentCommercialBilling,
  resolveAssignmentMultiCurrencyCost,
} from "./campaign-commercial";
import { aggregateCampaignKpis } from "./campaign-commercial";

async function main() {
  assert.equal(emptyToNull(""), null);
  assert.equal(emptyToNull("  hello  "), "hello");
  assert.equal(escapeIlikePattern("50%_off"), "50\\%\\_off");

  const costFx = resolveAssignmentMultiCurrencyCost({
    currency_code: "AED",
    cost_before_vat: 1000,
    cost_received: 250,
    cost_received_currency: "USD",
    fx_rate: 3.67,
    fx_from_currency: "USD",
    fx_to_currency: "AED",
  });
  assert.equal(costFx.cost_before_vat, 1000);
  assert.equal(costFx.cost_received, 250);
  assert.equal(costFx.fx_from_currency, "USD");
  assert.equal(costFx.fx_to_currency, "AED");

  const packageBilling = resolveAssignmentCommercialBilling(
    {
      pricing_mode: "package",
      commercial_rows: [],
    },
    100,
    50,
    15
  );
  assert.equal(packageBilling.usage_rights_amount, 100);
  assert.equal(packageBilling.agency_fee_percent, 15);

  const perDeliverableBilling = resolveAssignmentCommercialBilling(
    {
      pricing_mode: "per_deliverable",
      commercial_rows: [
        {
          quantity: 1,
          revenue_before_vat: 1000,
          usage_rights_amount: 200,
          usage_rights_cost: 80,
          agency_fee_percent: 10,
        },
      ],
    },
    0,
    0,
    0
  );
  assert.equal(perDeliverableBilling.usage_rights_amount, 200);
  assert.equal(perDeliverableBilling.usage_rights_cost, 80);
  assert.ok(perDeliverableBilling.agency_fee_percent > 0);

  const submitted = deliverableStatusTimestamps("submitted");
  assert.ok(submitted.submitted_at);
  assert.equal(deliveredStatusTimestampsSafe("draft").submitted_at, undefined);

  const kpis = aggregateCampaignKpis(
    [
      { id: "h1", status: "active", currency_code: "AED" },
      { id: "h2", status: "cancelled", currency_code: "USD" },
    ],
    [
      { campaign_header_id: "h1", revenue: 1000, profit: 200 },
      { campaign_header_id: "h2", revenue: 500, profit: 100 },
    ],
    [
      { id: "a1", campaign_header_id: "h1" },
      { id: "a2", campaign_header_id: "h2" },
    ]
  );
  assert.equal(kpis.total_campaigns, 1);
  assert.equal(kpis.total_revenue, 1000);
  assert.equal(kpis.avg_margin, 20);
  assert.equal(kpis.assignments, 1);
  assert.equal(kpis.currency_code, "AED");

  console.log("campaign-service-layer.test.ts: all assertions passed");
}

function deliveredStatusTimestampsSafe(status: string) {
  return deliverableStatusTimestamps(status);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
