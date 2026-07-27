import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import {
  approveMediaPlanOnCampaignObject,
  ensureWorkingDraftOnCampaignObject,
  getApprovedBaselineSchedule,
  getMediaPlanLifecycle,
  getMediaPlanRegenerateUiState,
  lockMediaPlanOnCampaignObject,
  mutateMediaPlanSchedule,
  prepareMediaPlanRegenerate,
  unlockMediaPlanOnCampaignObject,
} from "./media-plan-mutations";

const AT = "2026-07-27T12:00:00.000Z";

test("mutateMediaPlanSchedule writes only through engine and initializes lifecycle", () => {
  const object = buildCampaignObjectFixture();
  const result = mutateMediaPlanSchedule(
    object,
    { weekWeights: [40, 30, 20, 10] },
    { source: "studio_media_plan_ui", at: AT }
  );
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.message);
  assert.ok(result.campaignObject.meta.mediaPlanLifecycle);
  assert.equal(result.campaignObject.meta.mediaPlanLifecycle?.status, "draft");
  assert.deepEqual(
    result.campaignObject.meta.mediaPlanSchedule?.weekWeights?.slice(0, 4),
    [40, 30, 20, 10]
  );
  assert.ok((result.campaignObject.meta.mediaPlanSchedule?.weekWeights?.length ?? 0) >= 4);
});

test("approved baseline schedule is frozen when draft is edited", () => {
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
    actorUserId: "client_1",
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.message);

  const baseline = getApprovedBaselineSchedule(approved.campaignObject);
  assert.ok(baseline);
  const baselineJson = JSON.stringify(baseline);

  const edited = mutateMediaPlanSchedule(
    approved.campaignObject,
    { weekWeights: [25, 25, 25, 25] },
    { source: "studio_media_plan_ui", at: AT, autoForkDraft: true }
  );
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error(edited.message);
  assert.equal(edited.forkedDraft, true);
  assert.deepEqual(
    edited.campaignObject.meta.mediaPlanSchedule?.weekWeights?.slice(0, 4),
    [25, 25, 25, 25]
  );
  assert.equal(JSON.stringify(getApprovedBaselineSchedule(edited.campaignObject)), baselineJson);
});

test("locked plan rejects schedule mutation until unlock", () => {
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

  const blocked = mutateMediaPlanSchedule(
    locked.campaignObject,
    { weekWeights: [10, 20, 30, 40] },
    { source: "studio_media_plan_ui", at: AT, autoForkDraft: true }
  );
  assert.equal(blocked.ok, false);

  const unlocked = unlockMediaPlanOnCampaignObject(locked.campaignObject, { at: AT });
  assert.equal(unlocked.ok, true);
  if (!unlocked.ok) throw new Error(unlocked.message);

  const edited = mutateMediaPlanSchedule(
    unlocked.campaignObject,
    { weekWeights: [10, 20, 30, 40] },
    { source: "studio_media_plan_ui", at: AT }
  );
  assert.equal(edited.ok, true);
});

test("prepareMediaPlanRegenerate never mutates approved baseline; reuses single draft", () => {
  const object = buildCampaignObjectFixture();
  const seeded = mutateMediaPlanSchedule(
    object,
    { weekWeights: [50, 50] },
    { source: "studio_media_plan_ui", at: AT }
  );
  assert.equal(seeded.ok, true);
  if (!seeded.ok) throw new Error(seeded.message);

  const locked = lockMediaPlanOnCampaignObject(seeded.campaignObject, { at: AT });
  assert.equal(locked.ok, true);
  if (!locked.ok) throw new Error(locked.message);
  const approved = approveMediaPlanOnCampaignObject(locked.campaignObject, {
    at: AT,
    method: "on_behalf",
    approvalSource: "email",
  });
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.message);

  const ui = getMediaPlanRegenerateUiState(approved.campaignObject);
  assert.equal(ui.enabled, false);

  const prepared = prepareMediaPlanRegenerate(approved.campaignObject, { at: AT });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) throw new Error(prepared.message);
  assert.equal(prepared.createdDraft, true);
  assert.equal(prepared.canRegenerateNow, true);

  const again = prepareMediaPlanRegenerate(prepared.campaignObject, { at: AT });
  assert.equal(again.ok, true);
  if (!again.ok) throw new Error(again.message);
  assert.equal(again.createdDraft, false);
  assert.equal(again.draftVersion, prepared.draftVersion);

  const drafts = getMediaPlanLifecycle(again.campaignObject).history.filter(
    (entry) => entry.kind === "draft" && entry.version === again.draftVersion
  );
  assert.ok(drafts.length >= 1);

  const continued = ensureWorkingDraftOnCampaignObject(again.campaignObject, { at: AT });
  assert.equal(continued.ok, true);
  if (!continued.ok) throw new Error(continued.message);
  assert.equal(continued.forkedDraft, false);
  assert.equal(continued.draftVersion, prepared.draftVersion);
});

test("output generators cannot mutate schedule via ownership guard", () => {
  const object = buildCampaignObjectFixture();
  const result = mutateMediaPlanSchedule(
    object,
    { weekWeights: [100] },
    { source: "campaign_output_generator", at: AT }
  );
  assert.equal(result.ok, false);
});
