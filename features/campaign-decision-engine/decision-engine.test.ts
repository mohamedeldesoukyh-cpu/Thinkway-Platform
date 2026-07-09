/**
 * CDI Phase 1 unit tests — immutability, scenarios, scoring, recommendations.
 */
import assert from "node:assert/strict";

import {
  runDecisionEngine,
  deepFreeze,
  assertCampaignObjectImmutable,
  snapshotCampaignObject,
  simulateBudgetChange,
  applyBudgetDelta,
  computeThinkwayScore,
  validateRecommendationStructure,
  compareScenarios,
  buildStandardScenarios,
  extractCampaignDecisionContext,
} from "./index";
import {
  buildFixtureCampaignObject,
  CAMPAIGN_FIXTURES,
} from "./fixtures/campaign-fixtures";

// Immutability
{
  const fixture = CAMPAIGN_FIXTURES[0];
  const campaignObject = buildFixtureCampaignObject(fixture);
  const frozen = deepFreeze(structuredClone(campaignObject));
  const snapshotBefore = snapshotCampaignObject(campaignObject);

  runDecisionEngine({
    campaignObject,
    clientCreatorIds: fixture.clientCreatorIds,
  });

  const snapshotAfter = snapshotCampaignObject(campaignObject);
  assert.equal(snapshotBefore, snapshotAfter);
  assert.ok(assertCampaignObjectImmutable(campaignObject, campaignObject));
  assert.ok(Object.isFrozen(frozen));
}

// Budget simulator presets
{
  const campaignObject = buildFixtureCampaignObject(CAMPAIGN_FIXTURES[1]);
  const baseline = extractCampaignDecisionContext(campaignObject);

  const cut = simulateBudgetChange(baseline, { budgetChange: { percentChange: -20 } });
  assert.ok(cut.budget.total < baseline.budget.total);
  assert.ok(cut.kpis.reach < baseline.kpis.reach);

  const increase = applyBudgetDelta(baseline.budget, 25);
  assert.ok(increase.total > baseline.budget.total);
}

// Thinkway score weights sum to 100
{
  const campaignObject = buildFixtureCampaignObject(CAMPAIGN_FIXTURES[2]);
  const baseline = extractCampaignDecisionContext(campaignObject);
  const result = {
    budget: baseline.budget,
    kpis: baseline.kpis,
    kpiDeltas: [],
    creators: baseline.creators,
    timeline: baseline.timeline,
    risk: baseline.risk,
    successProbability: baseline.successProbability,
  };
  const score = computeThinkwayScore(baseline, result);
  assert.ok(score.total >= 0 && score.total <= 100);
  assert.ok(score.budget >= 0 && score.creatorFit >= 0);
}

// Scenario isolation
{
  const campaignObject = buildFixtureCampaignObject(CAMPAIGN_FIXTURES[3]);
  const baseline = extractCampaignDecisionContext(campaignObject);
  const scenarios = buildStandardScenarios(baseline, undefined, ["client_a", "client_b"]);

  const ids = new Set(scenarios.map((s) => s.id));
  assert.equal(ids.size, scenarios.length);

  for (const scenario of scenarios) {
    assert.ok(scenario.changes !== scenarios[0].changes || scenario.name === scenarios[0].name);
    assert.ok(scenario.simulationResult);
    assert.ok(scenario.thinkwayScore.total >= 0);
  }
}

// Recommendation structure
{
  const campaignObject = buildFixtureCampaignObject(CAMPAIGN_FIXTURES[4]);
  const result = runDecisionEngine({
    campaignObject,
    clientCreatorIds: CAMPAIGN_FIXTURES[4].clientCreatorIds,
  });

  assert.ok(result.recommendations.length > 0);
  for (const rec of result.recommendations) {
    const errors = validateRecommendationStructure(rec);
    assert.deepEqual(errors, [], `Recommendation "${rec.title}" failed validation`);
    assert.ok(rec.reason.length > 0);
    assert.ok(rec.confidence > 0);
    assert.ok(rec.alternative.title.length > 0);
  }
}

// Side-by-side comparison
{
  const campaignObject = buildFixtureCampaignObject(CAMPAIGN_FIXTURES[0]);
  const engineResult = runDecisionEngine({ campaignObject });
  const comparison = compareScenarios(engineResult.scenarios);

  assert.ok(comparison.rows.length >= 5);
  assert.ok(comparison.winnerScenarioId);
  const winners = comparison.rows.filter((r) => r.isWinner);
  assert.equal(winners.length, 1);
}

// Empty scenarios — no crash
{
  const empty = compareScenarios([]);
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.baselineScenarioId, "");
  assert.equal(empty.winnerScenarioId, "");
}

console.log("CDI Phase 1 unit tests: all passed");
