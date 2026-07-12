import assert from "node:assert/strict";

import {
  APPROVED_PLAN_EDIT_BLOCKED_MESSAGE,
  CAMPAIGN_PLAN_REVIEW_COMPLETION_THRESHOLD,
  canApproveCampaignPlan,
  canRequestCampaignPlanChanges,
  canSubmitCampaignPlanForReview,
  deriveCampaignPlanApprovalFlags,
  isCampaignPlanLockedForEdits,
  mapLifecycleToPresentationStatus,
} from "./campaign-plan-approval";

assert.equal(mapLifecycleToPresentationStatus("draft"), "draft");
assert.equal(mapLifecycleToPresentationStatus("in_review"), "awaiting_approval");
assert.equal(mapLifecycleToPresentationStatus("approved"), "approved");
assert.equal(mapLifecycleToPresentationStatus("published"), "approved");

assert.equal(
  canSubmitCampaignPlanForReview("draft", CAMPAIGN_PLAN_REVIEW_COMPLETION_THRESHOLD),
  true
);
assert.equal(
  canSubmitCampaignPlanForReview(
    "draft",
    CAMPAIGN_PLAN_REVIEW_COMPLETION_THRESHOLD - 1
  ),
  false
);
assert.equal(canSubmitCampaignPlanForReview("in_review", 100), false);

assert.equal(canApproveCampaignPlan("in_review"), true);
assert.equal(canApproveCampaignPlan("draft"), false);

assert.equal(canRequestCampaignPlanChanges("in_review"), true);
assert.equal(canRequestCampaignPlanChanges("approved"), true);
assert.equal(canRequestCampaignPlanChanges("published"), true);
assert.equal(canRequestCampaignPlanChanges("draft"), false);

assert.equal(isCampaignPlanLockedForEdits("approved"), true);
assert.equal(isCampaignPlanLockedForEdits("published"), true);
assert.equal(isCampaignPlanLockedForEdits("in_review"), false);

const flags = deriveCampaignPlanApprovalFlags({
  lifecycleStatus: "in_review",
  completionPercent: 95,
});
assert.equal(flags.canApprove, true);
assert.equal(flags.canSubmitForReview, false);
assert.equal(flags.canGenerate, false);

assert.ok(APPROVED_PLAN_EDIT_BLOCKED_MESSAGE.includes("Request changes"));

console.log("campaign-plan-approval.test.ts — all tests passed");
