import assert from "node:assert/strict";

import type { CampaignPlanReadiness } from "./campaign-plan-readiness";
import {
  canApproveCampaignPlan,
  canRequestCampaignPlanChanges,
  canSubmitCampaignPlanForReview,
  deriveCampaignPlanApprovalFlags,
  isCampaignPlanLockedForEdits,
  mapLifecycleToPresentationStatus,
} from "./campaign-plan-approval";

const ready: Pick<CampaignPlanReadiness, "status"> = { status: "ready_for_review" };
const notReady: Pick<CampaignPlanReadiness, "status"> = { status: "not_ready" };

assert.equal(mapLifecycleToPresentationStatus("draft"), "draft");
assert.equal(mapLifecycleToPresentationStatus("in_review"), "awaiting_approval");
assert.equal(mapLifecycleToPresentationStatus("approved"), "approved");
assert.equal(mapLifecycleToPresentationStatus("published"), "approved");

assert.equal(canSubmitCampaignPlanForReview("draft", ready), true);
assert.equal(canSubmitCampaignPlanForReview("draft", notReady), false);
assert.equal(canSubmitCampaignPlanForReview("in_review", ready), false);

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
  readiness: ready,
});
assert.equal(flags.canApprove, true);
assert.equal(flags.canSubmitForReview, false);
assert.equal(flags.canGenerate, false);

const draftReady = deriveCampaignPlanApprovalFlags({
  lifecycleStatus: "draft",
  readiness: ready,
});
assert.equal(draftReady.canSubmitForReview, true);

console.log("campaign-plan-approval.test.ts — all tests passed");
