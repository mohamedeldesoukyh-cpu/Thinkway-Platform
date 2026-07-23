import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  classifyCampaignType,
  campaignTypeLabel,
  campaignTypeSuggestsParticipation,
} from "@/features/campaign-outputs/campaign-type-classifier";

test("classifies Ramadan from brief signals", () => {
  const result = classifyCampaignType({
    briefText: "Ramadan campaign for a FMCG brand in KSA — iftar moments.",
    objective: "Drive awareness",
    marketCountry: "Saudi Arabia",
  });

  assert.equal(result.primary, "ramadan");
  assert.ok(result.signals.some((signal) => /ramadan/i.test(signal)));
});

test("classifies product launch from objective", () => {
  const result = classifyCampaignType({
    briefText: "New skincare serum for summer.",
    objective: "Product launch — drive trial among women 25-34",
    industry: "beauty",
  });

  assert.ok(result.primary === "product_launch" || result.primary === "beauty");
  assert.match(result.toneHint, /product|launch|awareness|beauty/i);
});

test("classifies conversion campaigns", () => {
  const result = classifyCampaignType({
    briefText: "E-commerce flash sale for electronics.",
    objective: "Drive sales and conversion",
  });

  assert.equal(result.primary, "conversion");
});

test("campaignTypeLabel formats snake_case", () => {
  assert.equal(campaignTypeLabel("brand_awareness"), "Brand Awareness");
});

test("engagement type suggests participation", () => {
  assert.equal(campaignTypeSuggestsParticipation("engagement"), true);
  assert.equal(campaignTypeSuggestsParticipation("conversion"), false);
});
