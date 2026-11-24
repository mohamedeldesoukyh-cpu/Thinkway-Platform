import assert from "node:assert/strict";
import { test } from "node:test";
import { applyCampaignFxRates, readCampaignFxRates } from "./campaign-fx-rates";
import { creatorFxAmount, makeCreatorFx } from "@/lib/commercial/creator-fx";

const custom = { AED: 14.9135, USD: 54.77 };
test("campaign rates preserve requested precision and reject invalid overrides", () => {
  assert.deepEqual(readCampaignFxRates({ fx_rates_to_egp: { ...custom, EGP: 2, EUR: -1, GBP: "60", bad: 1 } }), custom);
  assert.deepEqual(readCampaignFxRates({}), {});
});
test("campaign AED and USD rates drive EGP and cross-currency display", () => {
  const rates = new Map(Object.entries({ EGP: 1, AED: 14.91, USD: 55, EUR: 60 }));
  const system = { EGP: 1, AED: 14.91, USD: 55, EUR: 60 };
  const egp = applyCampaignFxRates(custom, "EGP", rates, system);
  assert.equal(egp.AED, 14.9135);
  assert.equal(egp.USD, 54.77);
  assert.equal(egp.EUR, 60);
  assert.equal(system.AED, 14.91);
  const usd = applyCampaignFxRates(custom, "USD", rates, { EGP: 1/55, AED: 0.27, USD: 1, EUR: 1.1 });
  assert.equal(usd.AED, 14.9135 / 54.77);
  assert.equal(usd.EGP, 1 / 54.77);
  assert.equal(usd.USD, 1);
  assert.equal(creatorFxAmount(1000, { from: "AED", to: "USD", sourceRateToEgp: 14.91, targetRateToEgp: 55,
    directRates: usd, override: makeCreatorFx("AED", "EGP", 14.9135, 1) }), 272.29);
});
test("campaigns without overrides retain direct system currency pairs", () => {
  const system = { EGP: 1/55, AED: 0.272, USD: 1 };
  assert.deepEqual(applyCampaignFxRates({}, "USD", new Map(), system), system);
});
test("eight decimal creator FX survives serialization", () => {
  const rate = 14.91351234;
  assert.equal(JSON.parse(makeCreatorFx("AED", "EGP", rate, 1)).rate, rate);
  assert.equal(creatorFxAmount(1000, { from: "AED", to: "EGP", sourceRateToEgp: rate, targetRateToEgp: 1 }), 14913.51);
});
