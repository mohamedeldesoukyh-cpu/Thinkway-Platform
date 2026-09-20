import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CampaignCurrencyProvider, CampaignMoney, CampaignLineFinancial } from "./campaign-money";
import type { CampaignWorkspace } from "@/features/campaigns/types";

const rates = { EGP: 1, USD: 52.2151, AED: 14, EUR: 56.75 };
function render(currency: string, child: React.ReactNode) {
  return renderToStaticMarkup(<CampaignCurrencyProvider workspace={{ currency_code: currency, currency_rates: rates, lines: [] } as unknown as CampaignWorkspace}>{child}</CampaignCurrencyProvider>).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}
test("selected currency is primary and the original amount is a secondary reference", () => {
  const money = createElement(CampaignMoney, { amount: 100, currency: "USD" });
  assert.match(render("EGP", money), /EGP 5,221\.51.*USD 100\.00 original/);
  assert.match(render("AED", money), /AED 372\.97.*USD 100\.00 original/);
  assert.doesNotMatch(render("USD", money), /original/);
});
test("mixed-currency assignment profit uses current vendor source cost", () => {
  const line = { currency_code: "USD", revenue_before_vat: 100, usage_rights_amount: 0, agency_fee_amount: 0,
    cost_before_vat: 1, cost_received: 100, cost_received_currency: "AED", usage_rights_cost: 0 } as CampaignWorkspace["lines"][number];
  assert.match(render("EGP", createElement(CampaignLineFinancial, { line, metric: "cost" })), /EGP 1,400\.00/);
  assert.match(render("EGP", createElement(CampaignLineFinancial, { line, metric: "gp" })), /EGP 3,821\.51/);
});
test("missing FX never labels the original value as the selected currency", () => {
  const html = render("EGP", createElement(CampaignMoney, { amount: 100, currency: "ZZZ" }));
  assert.match(html, /FX unavailable/);
  assert.doesNotMatch(html, /EGP 100/);
});
