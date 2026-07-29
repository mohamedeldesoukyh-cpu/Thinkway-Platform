import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  allocateMasterAcrossAssignments,
  assertOnlyMasterChanges,
  fromCampaignRow,
  fromQuotationRow,
  getFieldLevel,
  isDerivedFieldKey,
  isMasterFieldKey,
  isOperationalFieldKey,
  listMasterFields,
  toCampaignColumns,
  toQuotationColumns,
} from "./field-registry";

describe("Commercial Field Registry", () => {
  it("classifies Master, Derived, and Operational keys", () => {
    assert.equal(getFieldLevel("creator_cost"), "master");
    assert.equal(getFieldLevel("gross_profit"), "derived");
    assert.equal(getFieldLevel("publishing_dates"), "operational");
    assert.equal(getFieldLevel("not_a_field"), null);

    assert.equal(isMasterFieldKey("client_revenue"), true);
    assert.equal(isDerivedFieldKey("quotation_totals"), true);
    assert.equal(isOperationalFieldKey("performance_metrics"), true);
    assert.equal(isMasterFieldKey("gross_profit"), false);
  });

  it("rejects non-master keys in change sets", () => {
    const ok = assertOnlyMasterChanges({ creator_cost: 1000 });
    assert.equal(ok.ok, true);

    const bad = assertOnlyMasterChanges({
      creator_cost: 1000,
      gross_profit: 500,
    } as Parameters<typeof assertOnlyMasterChanges>[0]);
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.deepEqual(bad.rejectedFields, ["gross_profit"]);
  });

  it("maps logical Master keys to quotation and campaign columns", () => {
    const values = {
      creator_cost: 10000,
      client_revenue: 15000,
      agency_fee_percent: 10,
      cost_currency: "EGP",
    };
    assert.deepEqual(toQuotationColumns(values), {
      cost: 10000,
      revenue: 15000,
      af_pct: 10,
      cost_currency: "EGP",
    });
    const campaign = toCampaignColumns(values);
    assert.equal(campaign.cost_before_vat, 10000);
    assert.equal(campaign.cost, 10000);
    assert.equal(campaign.revenue_before_vat, 15000);
    assert.equal(campaign.revenue, 15000);
    assert.equal(campaign.agency_fee_percent, 10);
    assert.equal(campaign.currency_code, "EGP");
  });

  it("reads Master values from persistence-shaped rows", () => {
    assert.deepEqual(
      fromQuotationRow({ cost: 1, revenue: 2, af_pct: 5, cost_currency: "USD" }),
      {
        creator_cost: 1,
        client_revenue: 2,
        agency_fee_percent: 5,
        cost_currency: "USD",
      }
    );
    assert.equal(
      fromCampaignRow({
        cost_before_vat: 3,
        revenue_before_vat: 4,
        agency_fee_percent: 8,
      }).creator_cost,
      3
    );
  });

  it("equal-splits absolute amounts across N assignments; copies rates", () => {
    const shares = allocateMasterAcrossAssignments(
      {
        creator_cost: 100,
        client_revenue: 200,
        agency_fee_percent: 12,
        cost_currency: "EGP",
      },
      2
    );
    assert.equal(shares.length, 2);
    assert.equal(shares[0].creator_cost, 50);
    assert.equal(shares[1].creator_cost, 50);
    assert.equal(shares[0].client_revenue, 100);
    assert.equal(shares[1].client_revenue, 100);
    assert.equal(shares[0].agency_fee_percent, 12);
    assert.equal(shares[1].agency_fee_percent, 12);
    assert.equal(shares[0].cost_currency, "EGP");
  });

  it("registers the core Master commercial agreement fields", () => {
    const keys = new Set(listMasterFields().map((f) => f.key));
    for (const key of [
      "creator_cost",
      "client_revenue",
      "cost_currency",
      "exchange_rate",
      "agency_fee_percent",
    ]) {
      assert.ok(keys.has(key as never), `missing ${key}`);
    }
  });
});
