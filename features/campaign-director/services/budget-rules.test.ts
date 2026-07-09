import assert from "node:assert/strict";

import {
  briefForbidsBudgetSplit,
  briefRequiresOptionalCategories,
  buildDirectorBudgetFromStrategy,
  detectBudgetSplitKeywords,
} from "./budget-rules";
import { extractCampaignFacts } from "../facts/extract-campaign-facts";
import { runCampaignDirectorPipeline } from "./campaign-director";

const C16_BRIEF =
  "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC. No production. No usage rights.";

function testNegatedKeywordsDoNotTriggerSplit(): void {
  const keywords = detectBudgetSplitKeywords(C16_BRIEF);
  assert.equal(keywords.length, 0, `expected no split keywords, got ${JSON.stringify(keywords)}`);
  assert.equal(briefRequiresOptionalCategories(C16_BRIEF), false);
  assert.equal(briefForbidsBudgetSplit(C16_BRIEF), true);
}

function testAffirmativeKeywordsStillTriggerSplit(): void {
  const brief =
    "Luxury hotel launch in Dubai. Budget AED 1,200,000 for 10 weeks. Need dedicated studio photography and usage rights for paid boosting.";
  const keywords = detectBudgetSplitKeywords(brief);
  assert.ok(keywords.some((k) => k.keyword === "Production" || k.keyword === "Studio"));
  assert.ok(keywords.some((k) => k.keyword === "Usage Rights"));
  assert.equal(briefForbidsBudgetSplit(brief), false);
}

function testC16DirectorBudgetIs100PercentCreatorFees(): void {
  const facts = extractCampaignFacts({ rawMessage: C16_BRIEF, brandName: "BabyJoy" });
  const pipeline = runCampaignDirectorPipeline({
    brief: { rawMessage: C16_BRIEF, brandName: "BabyJoy", campaignFacts: facts },
    campaignFacts: facts,
  });
  const budget = buildDirectorBudgetFromStrategy(
    pipeline.strategyDocument,
    C16_BRIEF,
    facts
  );
  const creatorFees = budget.allocations.find((a) => /creator\s*fees?/i.test(a.category));
  assert.equal(creatorFees?.percent, 100, `allocations: ${JSON.stringify(budget.allocations)}`);
  assert.equal(budget.allocations.length, 1);
}

function testWithoutProductionVariant(): void {
  const brief = "Campaign for Brand X. Budget $100,000. Without production or usage rights.";
  assert.equal(detectBudgetSplitKeywords(brief).length, 0);
  assert.equal(briefForbidsBudgetSplit(brief), true);
}

function run(): void {
  testNegatedKeywordsDoNotTriggerSplit();
  testAffirmativeKeywordsStillTriggerSplit();
  testC16DirectorBudgetIs100PercentCreatorFees();
  testWithoutProductionVariant();
  console.log("budget-rules.test.ts: PASS");
}

run();
