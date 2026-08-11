import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  aggregateCampaignDisplayFinancials,
  resolveLineCostAmount,
  resolveLineCostCurrency,
  resolveLineRevenueCurrency,
} from "./campaign-display-financials";

describe("campaign-display-financials", () => {
  it("resolves entry currencies independently of display CCY", () => {
    assert.equal(
      resolveLineRevenueCurrency({ currency_code: "USD" }, "EGP"),
      "USD"
    );
    assert.equal(
      resolveLineCostCurrency(
        { currency_code: "EGP", cost_received_currency: "USD" },
        "EGP"
      ),
      "USD"
    );
    assert.equal(
      resolveLineCostAmount({ cost_received: 10000, cost_before_vat: 500000 }),
      10000
    );
  });

  it("projects USD line commercials into EGP display CCY", () => {
    const rateToEgpByCurrency = new Map([
      ["EGP", 1],
      ["USD", 50],
    ]);
    const result = aggregateCampaignDisplayFinancials({
      displayCurrency: "EGP",
      rateToEgpByCurrency,
      lines: [
        {
          currency_code: "USD",
          revenue_before_vat: 11200,
          cost_before_vat: 10000,
          cost_received: 10000,
          cost_received_currency: "USD",
          agency_fee_percent: 0,
          agency_fee_amount: 0,
        },
        {
          currency_code: "USD",
          revenue_before_vat: 5600,
          cost_before_vat: 5000,
          cost_received: 5000,
          cost_received_currency: "USD",
          agency_fee_percent: 0,
          agency_fee_amount: 0,
        },
      ],
    });

    assert.equal(result.currency_code, "EGP");
    assert.equal(result.revenue, 840_000); // (11200+5600)*50
    assert.equal(result.cost, 750_000); // (10000+5000)*50
    assert.equal(result.gp, 90_000);
    assert.equal(result.revenue_egp, 840_000);
    assert.equal(result.cost_egp, 750_000);
  });

  it("keeps USD display when invoice CCY is USD", () => {
    const rateToEgpByCurrency = new Map([
      ["EGP", 1],
      ["USD", 50],
    ]);
    const result = aggregateCampaignDisplayFinancials({
      displayCurrency: "USD",
      rateToEgpByCurrency,
      lines: [
        {
          currency_code: "USD",
          revenue_before_vat: 11200,
          cost_before_vat: 10000,
          cost_received: 10000,
          cost_received_currency: "USD",
        },
      ],
    });

    assert.equal(result.revenue, 11200);
    assert.equal(result.cost, 10000);
    assert.equal(result.gp, 1200);
  });
});
