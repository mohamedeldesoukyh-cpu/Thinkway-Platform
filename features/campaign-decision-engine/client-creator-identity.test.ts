import assert from "node:assert/strict";

import {
  findBaselineCreatorMatch,
  parseClientCreatorSlug,
  resolveClientCreatorDisplayName,
} from "./client-creator-identity";
import { evaluateClientCreators } from "./creator-simulator";
import { extractCampaignDecisionContext } from "./campaign-context";
import { buildFixtureCampaignObject, CAMPAIGN_FIXTURES } from "./fixtures/campaign-fixtures";

{
  const parsed = parseClientCreatorSlug("client_instagram_sarahstyle");
  assert.equal(parsed.platform, "instagram");
  assert.equal(parsed.handle, "@sarahstyle");
  assert.equal(parsed.label, "Sarahstyle");
}

{
  const parsed = parseClientCreatorSlug("client_mom_egypt_1");
  assert.equal(parsed.label, "Mom Egypt 1");
}

{
  const resolved = resolveClientCreatorDisplayName("client_inf:091c8f97-0678-4647-a42a-3b65f9880b94", {
    displayName: "Sarah Ahmed",
    handle: "@sarahstyle",
  });
  assert.equal(resolved.displayName, "Sarah Ahmed");
  assert.equal(resolved.handle, "@sarahstyle");
}

{
  const baseline = {
    creators: [
      {
        id: "inf:091c8f97-0678-4647-a42a-3b65f9880b94",
        displayName: "Sarah Ahmed",
        handle: "@sarahstyle",
        platform: "instagram",
        followers: 120_000,
        engagementRate: 4.2,
        postCount: 2,
        fitScore: 78,
        source: "thinkway" as const,
        cpm: 48,
      },
    ],
  };

  const match = findBaselineCreatorMatch(
    baseline.creators,
    "client_inf:091c8f97-0678-4647-a42a-3b65f9880b94"
  );
  assert.equal(match?.displayName, "Sarah Ahmed");

  const evaluations = evaluateClientCreators(
    {
      campaignObjectId: "test",
      currency: "EGP",
      budget: { currency: "EGP", total: 1_000_000, creatorFees: 600_000, production: 300_000, contingency: 100_000 },
      kpis: {
        reach: 1_000_000,
        engagement: 50_000,
        engagementRate: 5,
        impressions: 1_000_000,
        awareness: 70,
        cpm: 48,
        cpe: 7,
        roas: 3,
        conversions: 1000,
        creatorCount: 1,
        postCount: 2,
      },
      creators: baseline.creators,
      timeline: { durationWeeks: 6, goLiveWeek: 5 },
      risk: { level: "medium", score: 70, highRiskCount: 1, factors: [] },
      successProbability: 75,
      platforms: ["instagram"],
    },
    ["client_inf:091c8f97-0678-4647-a42a-3b65f9880b94"]
  );

  assert.equal(evaluations[0]?.clientCreator.displayName, "Sarah Ahmed");
}

{
  const campaignObject = buildFixtureCampaignObject(CAMPAIGN_FIXTURES[0]);
  const baseline = extractCampaignDecisionContext(campaignObject);
  const evaluations = evaluateClientCreators(baseline, CAMPAIGN_FIXTURES[0].clientCreatorIds);
  assert.equal(evaluations[0]?.clientCreator.displayName, "Mom Egypt 1");
  assert.equal(evaluations[1]?.clientCreator.displayName, "Mom Egypt 2");
}

console.log("client-creator-identity tests: all passed");
