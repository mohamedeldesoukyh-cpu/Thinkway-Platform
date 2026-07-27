import assert from "node:assert/strict";
import { test } from "node:test";

import {
  approveMediaPlanOnCampaignObject,
  getApprovedBaselineSchedule,
  lockMediaPlanOnCampaignObject,
  mutateMediaPlanSchedule,
} from "@/features/campaign-outputs/media-plan-mutations";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { buildClientPortalOriginalPayload } from "@/features/portals/queries/client-media-plan-payload";
import { mediaPlanDataToItems } from "@/lib/media-plan/calendar-adapter";
import {
  resolveApprovedBaselineData,
  resolveOriginalData,
} from "@/lib/media-plan/resolve-calendar-data";

const AT = "2026-07-27T12:00:00.000Z";

test("portal Original hides unshared draft Media Plan", () => {
  const object = buildCampaignObjectFixture();
  const seeded = mutateMediaPlanSchedule(
    object,
    { weekWeights: [50, 50] },
    { source: "studio_media_plan_ui", at: AT }
  );
  assert.equal(seeded.ok, true);
  if (!seeded.ok) throw new Error(seeded.message);

  const payload = buildClientPortalOriginalPayload({
    campaignId: "camp-1",
    campaignName: "Demo",
    documentNumber: "TW-2026-0001",
    campaignObject: seeded.campaignObject,
  });

  assert.ok(payload.emptyReason);
  assert.match(payload.emptyReason ?? "", /not ready for client review/i);
  assert.equal(payload.canDecide, false);
});

test("portal pending review shows locked tip and enables decisions for approve role", () => {
  const object = buildCampaignObjectFixture();
  const seeded = mutateMediaPlanSchedule(
    object,
    { weekWeights: [40, 30, 20, 10] },
    { source: "studio_media_plan_ui", at: AT }
  );
  assert.equal(seeded.ok, true);
  if (!seeded.ok) throw new Error(seeded.message);

  const locked = lockMediaPlanOnCampaignObject(seeded.campaignObject, { at: AT });
  assert.equal(locked.ok, true);
  if (!locked.ok) throw new Error(locked.message);

  const payload = buildClientPortalOriginalPayload({
    campaignId: "camp-1",
    campaignName: "Demo",
    documentNumber: "TW-2026-0001",
    campaignObject: locked.campaignObject,
    conversationId: "11111111-1111-1111-1111-111111111111",
    hasApproveRole: true,
  });

  assert.equal(payload.emptyReason, null);
  assert.equal(payload.viewMode, "pending_review");
  assert.equal(payload.canApprove, true);
  assert.equal(payload.canRequestChanges, true);
  assert.equal(payload.canReject, true);

  const tip = resolveOriginalData(locked.campaignObject);
  assert.deepEqual(
    mediaPlanDataToItems(payload.original).map((item) => item.plannedDate),
    mediaPlanDataToItems(tip).map((item) => item.plannedDate)
  );
});

test("portal Original uses approved baseline schedule, never working draft tip", () => {
  const object = buildCampaignObjectFixture();
  const seeded = mutateMediaPlanSchedule(
    object,
    {
      weekWeights: [70, 10, 10, 10],
      moveCreators: [{ creatorIds: ["cr_star"], toWeek: 1, toDayIndex: 0 }],
    },
    { source: "studio_media_plan_ui", at: AT }
  );
  assert.equal(seeded.ok, true);
  if (!seeded.ok) throw new Error(seeded.message);

  const locked = lockMediaPlanOnCampaignObject(seeded.campaignObject, { at: AT });
  assert.equal(locked.ok, true);
  if (!locked.ok) throw new Error(locked.message);

  const approved = approveMediaPlanOnCampaignObject(locked.campaignObject, {
    at: AT,
    method: "client_portal",
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.message);

  const baselineSchedule = getApprovedBaselineSchedule(approved.campaignObject);
  assert.ok(baselineSchedule);

  const draftEdited = mutateMediaPlanSchedule(
    approved.campaignObject,
    { weekWeights: [10, 10, 10, 70] },
    { source: "studio_media_plan_ui", at: AT, autoForkDraft: true }
  );
  assert.equal(draftEdited.ok, true);
  if (!draftEdited.ok) throw new Error(draftEdited.message);
  assert.equal(draftEdited.forkedDraft, true);

  const payload = buildClientPortalOriginalPayload({
    campaignId: "camp-1",
    campaignName: "Demo",
    documentNumber: "TW-2026-0001",
    campaignObject: draftEdited.campaignObject,
    hasApproveRole: true,
  });

  assert.equal(payload.emptyReason, null);
  assert.equal(payload.viewMode, "approved_original");
  assert.equal(payload.baselineVersion, 1);
  // Working draft is open internally — portal shows frozen baseline without decision buttons.
  assert.equal(payload.canApprove, false);
  assert.equal(payload.canRequestChanges, false);
  assert.equal(payload.canReject, false);

  const tip = resolveOriginalData(draftEdited.campaignObject);
  const baseline = resolveApprovedBaselineData(draftEdited.campaignObject, tip);
  assert.deepEqual(
    mediaPlanDataToItems(payload.original).map((item) => ({
      id: item.id,
      plannedDate: item.plannedDate,
    })),
    mediaPlanDataToItems(baseline).map((item) => ({
      id: item.id,
      plannedDate: item.plannedDate,
    }))
  );
});
