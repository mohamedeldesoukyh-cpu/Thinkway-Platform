import assert from "node:assert/strict";
import test from "node:test";

import {
  expandRegionalGeography,
  resolveMarketCountryFromLabel,
} from "./market-calendar-db";
import { resolveMarketIndustryCategory } from "./market-industry-intelligence";
import { resolveMarketIntelligenceConfig } from "./market-intelligence-config";
import {
  buildMarketSchedulingContext,
  marketDayPlacementBonus,
  marketWeekAllocationBonus,
  resolveMarketWindows,
  scoreMarketOpportunityForDate,
  scoreMarketOpportunityForWeek,
} from "./market-intelligence-engine";
import { buildMarketTimingRationale } from "./market-timing-rationale";
import { DEFAULT_MARKET_INTELLIGENCE_CONFIG } from "./types";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";

test("resolveMarketCountryFromLabel maps aliases", () => {
  assert.equal(resolveMarketCountryFromLabel("KSA"), "Saudi Arabia");
  assert.equal(resolveMarketCountryFromLabel("dubai"), "UAE");
  assert.equal(resolveMarketCountryFromLabel("United Kingdom"), "UK");
});

test("resolveMarketCountryFromLabel maps ISO codes", () => {
  assert.equal(resolveMarketCountryFromLabel("EG"), "Egypt");
  assert.equal(resolveMarketCountryFromLabel("AE"), "UAE");
  assert.equal(resolveMarketCountryFromLabel("SA"), "Saudi Arabia");
  assert.equal(resolveMarketCountryFromLabel("GB"), "UK");
  assert.equal(resolveMarketCountryFromLabel("US"), "USA");
});

test("expandRegionalGeography resolves ISO codes without UAE fallback", () => {
  const egypt = expandRegionalGeography(["EG"]);
  assert.deepEqual(egypt, ["Egypt"]);
  assert.equal(egypt.includes("UAE"), false);
});

test("expandRegionalGeography expands MENA and GCC", () => {
  const mena = expandRegionalGeography(["MENA"]);
  assert.ok(mena.includes("UAE"));
  assert.ok(mena.includes("Egypt"));
  const gcc = expandRegionalGeography(["GCC"]);
  assert.ok(gcc.includes("Qatar"));
  assert.equal(gcc.includes("Egypt"), false);
});

test("resolveMarketIndustryCategory detects verticals from brief", () => {
  assert.equal(resolveMarketIndustryCategory(undefined, "Fashion apparel launch"), "fashion");
  assert.equal(resolveMarketIndustryCategory("telecom", "5G network"), "telecom");
  assert.equal(resolveMarketIndustryCategory(undefined, "Generic brand campaign"), "general");
});

test("resolveMarketIndustryCategory detects food from seafood and brand", () => {
  assert.equal(resolveMarketIndustryCategory(undefined, "Canned tuna awareness campaign"), "food");
  assert.equal(resolveMarketIndustryCategory(undefined, "Brand launch", "Tuna Dolphin"), "food");
  assert.equal(resolveMarketIndustryCategory("cpg", undefined), "food");
});

test("resolveMarketIntelligenceConfig uses Egypt for EG geography", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.campaignFacts = {
    ...obj.meta.campaignFacts,
    geography: ["EG"],
    brandName: "Tuna Dolphin",
    objective: "Drive awareness for canned tuna",
  };
  const config = resolveMarketIntelligenceConfig(obj);
  assert.deepEqual(config.countries, ["Egypt"]);
  assert.equal(config.category, "food");
  assert.equal(config.countries.includes("UAE"), false);
});

test("salary first-week scores higher than mid-month for fashion UAE", () => {
  const start = new Date(2026, 6, 1, 12, 0, 0, 0);
  const config = {
    ...DEFAULT_MARKET_INTELLIGENCE_CONFIG,
    countries: ["UAE"] as const,
    category: "fashion" as const,
  };
  const windows = resolveMarketWindows({
    countries: ["UAE"],
    startDate: start,
    endDate: new Date(2026, 6, 31, 12, 0, 0, 0),
    config: { ...config, countries: ["UAE"] },
  });
  assert.ok(windows.length > 0);

  const firstWeek = scoreMarketOpportunityForDate(
    new Date(2026, 6, 3, 12, 0, 0, 0),
    windows,
    "fashion",
    { ...config, countries: ["UAE"] }
  );
  const midMonth = scoreMarketOpportunityForDate(
    new Date(2026, 6, 15, 12, 0, 0, 0),
    windows,
    "fashion",
    { ...config, countries: ["UAE"] }
  );
  assert.ok(
    firstWeek.score >= midMonth.score,
    `first week ${firstWeek.score} should beat mid-month ${midMonth.score}`
  );
  assert.ok(firstWeek.reasons.length > 0 || firstWeek.activeWindows.length > 0);
});

test("disabled ramadan toggle excludes religious windows", () => {
  const start = new Date(2026, 1, 1, 12, 0, 0, 0);
  const end = new Date(2026, 3, 30, 12, 0, 0, 0);
  const enabled = resolveMarketWindows({
    countries: ["UAE"],
    startDate: start,
    endDate: end,
    config: DEFAULT_MARKET_INTELLIGENCE_CONFIG,
  });
  const disabled = resolveMarketWindows({
    countries: ["UAE"],
    startDate: start,
    endDate: end,
    config: {
      ...DEFAULT_MARKET_INTELLIGENCE_CONFIG,
      toggles: { ...DEFAULT_MARKET_INTELLIGENCE_CONFIG.toggles, ramadan: false },
    },
  });
  const enabledRamadan = enabled.filter((w) => /ramadan|eid/i.test(w.eventName));
  const disabledRamadan = disabled.filter((w) => /ramadan|eid/i.test(w.eventName));
  assert.ok(enabledRamadan.length > 0);
  assert.equal(disabledRamadan.length, 0);
});

test("master enabled:false yields neutral market bonuses", () => {
  const context = buildMarketSchedulingContext({
    campaignStartDate: new Date(2026, 6, 1, 12, 0, 0, 0),
    durationWeeks: 4,
    config: { ...DEFAULT_MARKET_INTELLIGENCE_CONFIG, enabled: false },
  });
  const dayBonus = marketDayPlacementBonus(3, context);
  const weekBonus = marketWeekAllocationBonus(1, context);
  assert.equal(dayBonus.bonus, 0);
  assert.equal(weekBonus.bonus, 0);
});

test("resolveMarketIntelligenceConfig reads campaign geography", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.campaignFacts = {
    ...obj.meta.campaignFacts,
    geography: ["UAE", "Saudi Arabia"],
    industry: "retail",
  };
  const config = resolveMarketIntelligenceConfig(obj);
  assert.ok(config.countries.includes("UAE"));
  assert.ok(config.countries.includes("Saudi Arabia"));
  assert.equal(config.enabled, true);
  assert.equal(config.toggles.salaryCycle, true);
});

test("buildMarketTimingRationale references salary and retail signals", () => {
  const context = buildMarketSchedulingContext({
    campaignStartDate: new Date(2026, 7, 1, 12, 0, 0, 0),
    durationWeeks: 4,
    config: {
      ...DEFAULT_MARKET_INTELLIGENCE_CONFIG,
      countries: ["UAE"],
      category: "fashion",
    },
  });
  const narrative = buildMarketTimingRationale({
    context,
    weekWeights: [40, 30, 20, 10],
    durationWeeks: 4,
    objective: "Drive conversion and sales",
  });
  assert.match(narrative, /market intelligence|UAE|salary|conversion/i);
});

test("week score aggregates daily opportunity", () => {
  const context = buildMarketSchedulingContext({
    campaignStartDate: new Date(2026, 10, 20, 12, 0, 0, 0),
    durationWeeks: 2,
    config: {
      ...DEFAULT_MARKET_INTELLIGENCE_CONFIG,
      countries: ["UAE"],
      category: "electronics",
    },
  });
  const weekScore = scoreMarketOpportunityForWeek(context.campaignStartDate, 1, context);
  assert.ok(weekScore.score >= 0 && weekScore.score <= 100);
});
