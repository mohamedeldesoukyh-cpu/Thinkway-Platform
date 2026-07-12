import assert from "node:assert/strict";

import {
  canGenerateFromCampaignPlan,
  isCampaignPlanApproved,
  parseCampaignPlanProvenance,
} from "./campaign-plan-provenance";

assert.equal(parseCampaignPlanProvenance(null), null);
assert.equal(parseCampaignPlanProvenance({ campaign_object_id: null }), null);
assert.equal(parseCampaignPlanProvenance({ campaign_object_id: "" }), null);

const parsed = parseCampaignPlanProvenance({
  campaign_object_id: "co-1",
  source_campaign_object_version: 3,
});
assert.deepEqual(parsed, {
  campaignObjectId: "co-1",
  sourceCampaignObjectVersion: 3,
});

assert.equal(
  parseCampaignPlanProvenance({ campaign_object_id: "co-2", source_campaign_object_version: null })
    ?.sourceCampaignObjectVersion,
  null
);

assert.equal(isCampaignPlanApproved("approved"), true);
assert.equal(isCampaignPlanApproved("published"), true);
assert.equal(isCampaignPlanApproved("in_review"), false);
assert.equal(isCampaignPlanApproved("draft"), false);

assert.equal(canGenerateFromCampaignPlan("approved"), true);
assert.equal(canGenerateFromCampaignPlan("draft"), false);

console.log("campaign-plan-provenance.test.ts — all tests passed");
