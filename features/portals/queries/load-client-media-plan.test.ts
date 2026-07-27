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

test("portal Original hides unapproved draft Media Plan", () => {
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
  assert.match(payload.emptyReason ?? "", /not been approved/i);
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
  assert.deepEqual(
    draftEdited.campaignObject.meta.mediaPlanSchedule?.weekWeights?.slice(0, 4),
    [10, 10, 10, 70]
  );
  assert.deepEqual(
    getApprovedBaselineSchedule(draftEdited.campaignObject)?.weekWeights?.slice(0, 4),
    baselineSchedule?.weekWeights?.slice(0, 4)
  );

  const payload = buildClientPortalOriginalPayload({
    campaignId: "camp-1",
    campaignName: "Demo",
    documentNumber: "TW-2026-0001",
    campaignObject: draftEdited.campaignObject,
  });

  assert.equal(payload.emptyReason, null);
  assert.equal(payload.baselineVersion, 1);

  const tip = resolveOriginalData(draftEdited.campaignObject);
  const baseline = resolveApprovedBaselineData(draftEdited.campaignObject, tip);
  const portalItems = mediaPlanDataToItems(payload.original).map((item) => ({
    id: item.id,
    plannedDate: item.plannedDate,
  }));
  const baselineItems = mediaPlanDataToItems(baseline).map((item) => ({
    id: item.id,
    plannedDate: item.plannedDate,
  }));

  assert.deepEqual(portalItems, baselineItems);
});
