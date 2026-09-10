/**
 * Strategy must not be influenced by any creator score.
 *
 * Six score concepts exist and must stay separate: the Thinkway creator score,
 * the campaign relevance score, the ECI investment score, the Studio
 * requirement score, the quantity-recommendation confidence, and campaign
 * health / strategy scores. Strategy generation is grounded in confirmed
 * Campaign Intelligence only.
 *
 * Source-contract tests: they pin that the Strategy modules never reach for a
 * creator score.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const STRATEGY_MODULES = [
  "features/campaign-director/services/strategy-document.ts",
  "features/campaign-studio/services/influencer-strategy-view.ts",
  "features/campaign-intelligence/services/reasoning/campaign-context.ts",
  "features/campaign-studio/services/creator-quantity.ts",
];

/** Identifiers that would mean a creator score had entered Strategy. */
const CREATOR_SCORE_TOKENS = [
  "thinkway_score",
  "computeThinkwayScore",
  "campaign_relevance_score",
  "campaignRelevanceScore",
  "scoreCreatorCampaignRelevance",
  "eci_investment_score",
  "discoveryInvestmentScore",
  "brand_fit_score",
  "studioCreatorRequirementScore",
  "studioCreatorRankingScore",
  "computeCreatorPriorityScore",
  "platformFitScore",
  "healthScore",
];

for (const file of STRATEGY_MODULES) {
  test(`${file} uses no creator score`, () => {
    const source = readFileSync(file, "utf8");
    for (const token of CREATOR_SCORE_TOKENS) {
      assert.ok(
        !source.includes(token),
        `${file} references ${token} — Strategy must be grounded in Campaign Intelligence, not creator scores`
      );
    }
  });
}

test("the quantity recommendation reads only campaign facts", () => {
  const source = readFileSync("features/campaign-studio/services/creator-quantity.ts", "utf8");

  // Its only inputs: the facts, an optional pool size, and an optional
  // Strategy tier mix.
  assert.match(source, /facts\?\.\s*durationWeeks/);
  assert.match(source, /facts\?\.\s*objective/);
  assert.match(source, /facts\?\.\s*budget|budgetLift\(facts\)/);
  assert.match(source, /options\?\.\s*poolSize/);
  assert.ok(
    !/creator\.|vendor\.|unified_id/.test(source),
    "it must never inspect an individual creator"
  );
});

test("the quantity confidence is a three-fact lookup and nothing else", () => {
  const source = readFileSync("features/campaign-studio/services/creator-quantity.ts", "utf8");
  assert.match(
    source,
    /const confidence = present === 3 \? 0\.86 : present === 2 \? 0\.64 : 0\.42;/,
    "the confidence formula changed — confirm it still measures only evidence completeness"
  );
  assert.match(
    source,
    /duration\.base != null,\s*\n\s*Boolean\(budget\.evidence\),\s*\n\s*Boolean\(facts\?\.objective\?\.trim\(\)\),/,
    "the three facts it counts changed"
  );
});

test("platform never contributes to the quantity confidence", () => {
  const source = readFileSync("features/campaign-studio/services/creator-quantity.ts", "utf8");
  // Platforms may add a creator for coverage; they must not touch `present`.
  const presentBlock = source.slice(source.indexOf("const present = ["), source.indexOf("].filter(Boolean).length"));
  assert.ok(!/platform/i.test(presentBlock), "platform must not enter the confidence inputs");
});

test("Strategy generation is grounded in facts, and its defaults are visible", () => {
  const source = readFileSync("features/campaign-director/services/strategy-document.ts", "utf8");

  // Documented generic fallbacks. This test does not endorse them — it makes a
  // silent change to them impossible.
  assert.match(source, /facts\.objective \?\? "Brand awareness and engagement"/);
  assert.match(source, /facts\.audience \?\? "Brand-relevant consumers in primary market"/);
  assert.match(source, /Creator fees include production unless brief specifies separate production budget/);
  assert.match(source, /Standard vendor availability and content approval timelines/);
});
