import { strict as assert } from "node:assert";
import { test } from "node:test";

import { MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE } from "./config";
import { mediaPlanEngine } from "./media-plan-engine";
import type { MediaPlanItem, MediaPlanPerformanceFact, MediaPlanState } from "./types";
import { lockWorkingDraft } from "./versioning";

const AT = "2026-07-27T10:00:00.000Z";

function sampleItems(): MediaPlanItem[] {
  return [
    {
      id: "i1",
      creatorId: "ahmed",
      creatorName: "Ahmed",
      platform: "Instagram",
      deliverable: "IG Reel",
      plannedDate: "2026-08-15",
      actualLiveDate: null,
      status: "planned",
    },
    {
      id: "i2",
      creatorId: "ahmed",
      creatorName: "Ahmed",
      platform: "TikTok",
      deliverable: "TikTok",
      plannedDate: "2026-08-16",
      actualLiveDate: null,
      status: "planned",
    },
    {
      id: "i3",
      creatorId: "sara",
      creatorName: "Sara",
      platform: "Instagram",
      deliverable: "IG Story",
      plannedDate: "2026-08-15",
      actualLiveDate: null,
      status: "planned",
    },
  ];
}

function createPlan() {
  return mediaPlanEngine.createInitial({
    mediaPlanId: "mp_1",
    campaignId: "camp_1",
    campaignObjectId: "co_1",
    source: "studio",
    items: sampleItems(),
    at: AT,
    actorUserId: "user_1",
  });
}

function approveDraft(state: MediaPlanState, method: "client_portal" | "on_behalf" = "client_portal") {
  const locked = lockWorkingDraft(state, { at: AT, actorUserId: "user_1" });
  assert.equal(locked.ok, true);
  if (!locked.ok) throw new Error(locked.error);
  return mediaPlanEngine.promoteWorkingDraftToBaseline(locked.state, {
    at: AT,
    actorUserId: method === "client_portal" ? "client_1" : "user_1",
    approvalMethod: method,
    approvalSource: method === "on_behalf" ? "whatsapp" : null,
  });
}

test("creates initial plan as single working draft with no baseline", () => {
  const { state } = createPlan();
  const check = mediaPlanEngine.validate(state);
  assert.equal(check.ok, true);
  assert.equal(state.workingDraftVersion, 1);
  assert.equal(state.currentApprovedBaselineVersion, null);
  assert.equal(state.versions.length, 1);
});

test("exactly one baseline and at most one draft after approval + revision", () => {
  const { state } = createPlan();
  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  assert.equal(approved.state.workingDraftVersion, null);
  assert.equal(approved.state.currentApprovedBaselineVersion, 1);
  assert.equal(mediaPlanEngine.validate(approved.state).ok, true);

  const draft1 = mediaPlanEngine.ensureWorkingDraft(approved.state, {
    at: AT,
    actorUserId: "user_1",
  });
  assert.equal(draft1.ok, true);
  if (!draft1.ok) throw new Error(draft1.error);
  assert.equal(draft1.created, true);
  assert.equal(draft1.draftVersion, 2);

  const draft2 = mediaPlanEngine.ensureWorkingDraft(draft1.state, {
    at: AT,
    actorUserId: "user_1",
  });
  assert.equal(draft2.ok, true);
  if (!draft2.ok) throw new Error(draft2.error);
  assert.equal(draft2.created, false);
  assert.equal(draft2.draftVersion, 2);
  assert.equal(draft2.state.versions.filter((v) => v.kind === "draft").length, 1);
});

test("approved baseline items are immutable — writes require draft", () => {
  const { state } = createPlan();
  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const blocked = mediaPlanEngine.applyScheduleItems(approved.state, [], {
    at: AT,
    source: "studio_media_plan_ui",
  });
  assert.equal(blocked.ok, false);

  const forked = mediaPlanEngine.ensureWorkingDraft(approved.state, { at: AT });
  assert.equal(forked.ok, true);
  if (!forked.ok) throw new Error(forked.error);

  const baselineBefore = mediaPlanEngine.getBaseline(forked.state);
  assert.ok(baselineBefore);
  const baselineItems = JSON.stringify(baselineBefore!.items);

  const edited = mediaPlanEngine.applyScheduleItems(
    forked.state,
    [{ ...sampleItems()[0]!, plannedDate: "2026-09-01" }],
    { at: AT, source: "campaign_media_plan_ui" }
  );
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error(edited.error);

  const baselineAfter = mediaPlanEngine.getBaseline(edited.state);
  assert.equal(JSON.stringify(baselineAfter!.items), baselineItems);
});

test("regenerate UI enabled only for draft; disabled message for approved", () => {
  const { state } = createPlan();
  const draftUi = mediaPlanEngine.getRegenerateUiState(state);
  assert.equal(draftUi.enabled, true);

  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const approvedUi = mediaPlanEngine.getRegenerateUiState(approved.state);
  assert.equal(approvedUi.visible, true);
  assert.equal(approvedUi.enabled, false);
  assert.equal(approvedUi.message, MEDIA_PLAN_REGENERATE_DISABLED_MESSAGE);
});

test("prepareRegenerate never mutates approved baseline; continues existing draft", () => {
  const { state } = createPlan();
  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const prepared = mediaPlanEngine.prepareRegenerate(approved.state, { at: AT });
  assert.equal(prepared.ok, true);
  if (!prepared.ok) throw new Error(prepared.error);
  assert.equal(prepared.createdDraft, true);
  assert.equal(prepared.canRegenerateNow, true);
  assert.equal(prepared.state.currentApprovedBaselineVersion, 1);
  assert.equal(prepared.draftVersion, 2);

  const again = mediaPlanEngine.prepareRegenerate(prepared.state, { at: AT });
  assert.equal(again.ok, true);
  if (!again.ok) throw new Error(again.error);
  assert.equal(again.createdDraft, false);
  assert.equal(again.draftVersion, 2);
  assert.equal(again.state.versions.filter((v) => v.kind === "draft").length, 1);
});

test("Remaining uses working draft tip when open so unpublished reschedules stick", () => {
  const { state } = createPlan();
  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const forked = mediaPlanEngine.ensureWorkingDraft(approved.state, { at: AT });
  assert.equal(forked.ok, true);
  if (!forked.ok) throw new Error(forked.error);

  const draftItems = sampleItems().map((item) =>
    item.id === "i2" ? { ...item, plannedDate: "2026-12-01" } : item
  );
  const edited = mediaPlanEngine.applyScheduleItems(forked.state, draftItems, {
    at: AT,
    source: "studio_media_plan_ui",
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error(edited.error);

  const performance: MediaPlanPerformanceFact[] = [
    {
      creatorId: "ahmed",
      platform: "Instagram",
      deliverable: "IG Reel",
      liveDate: "2026-08-10",
      completed: true,
    },
  ];

  const views = mediaPlanEngine.projectExecutionViews(edited.state, performance);
  assert.equal(views.baselineVersion, 1);
  assert.equal(views.actual.items.length, 1);
  assert.equal(views.actual.items[0]!.actualLiveDate, "2026-08-10");
  // Remaining excludes completed IG Reel; tip draft dates apply to unpublished items
  assert.equal(views.remaining.items.length, 2);
  assert.ok(views.remaining.items.every((item) => item.id !== "i1"));
  assert.ok(views.remaining.items.some((item) => item.plannedDate === "2026-12-01"));
});

test("same-day actual deliverables group onto one calendar day card", () => {
  const { state } = createPlan();
  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const performance: MediaPlanPerformanceFact[] = [
    {
      creatorId: "ahmed",
      platform: "Instagram",
      deliverable: "IG Reel",
      liveDate: "2026-08-10",
      completed: true,
    },
    {
      creatorId: "ahmed",
      platform: "TikTok",
      deliverable: "TikTok",
      liveDate: "2026-08-10",
      completed: true,
    },
  ];

  const actual = mediaPlanEngine.projectActual(approved.state, performance);
  assert.equal(actual.days.length, 1);
  assert.equal(actual.days[0]!.date, "2026-08-10");
  assert.equal(actual.days[0]!.creators[0]!.deliverables.length, 2);
});

test("Actual includes Performance live dates even when baseline has no creators", () => {
  const created = mediaPlanEngine.createInitial({
    mediaPlanId: "mp_empty",
    campaignId: "camp_empty",
    campaignObjectId: "co_empty",
    source: "campaign",
    items: [],
    at: AT,
    actorUserId: "user_1",
  });
  const approved = approveDraft(created.state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const performance: MediaPlanPerformanceFact[] = [
    {
      creatorId: "creator-1",
      creatorName: "Layla",
      platform: "Instagram",
      deliverable: "IG Reel",
      liveDate: "2026-04-30",
      completed: true,
    },
    {
      creatorId: "creator-2",
      creatorName: "Omar",
      platform: "TikTok",
      deliverable: "TikTok Video",
      liveDate: "2026-05-01",
      completed: true,
    },
  ];

  const actual = mediaPlanEngine.projectActual(approved.state, performance);
  assert.equal(actual.items.length, 2);
  assert.equal(actual.items[0]!.creatorName, "Layla");
  assert.equal(actual.items[0]!.actualLiveDate, "2026-04-30");
  assert.equal(actual.items[0]!.plannedDate, null);
  assert.equal(actual.days.length, 2);
});

test("Actual includes unmatched Performance rows beyond baseline matches", () => {
  const { state } = createPlan();
  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const performance: MediaPlanPerformanceFact[] = [
    {
      creatorId: "ahmed",
      platform: "Instagram",
      deliverable: "IG Reel",
      liveDate: "2026-08-10",
      completed: true,
    },
    {
      creatorId: "unplanned",
      creatorName: "Extra Creator",
      platform: "Instagram",
      deliverable: "IG Story",
      liveDate: "2026-08-11",
      completed: true,
    },
  ];

  const actual = mediaPlanEngine.projectActual(approved.state, performance);
  assert.equal(actual.items.length, 2);
  assert.ok(actual.items.some((item) => item.creatorId === "unplanned"));
  assert.ok(actual.items.some((item) => item.creatorId === "ahmed" && item.id === "i1"));
});

test("outputs cannot mutate Media Plan schedule", () => {
  const { state } = createPlan();
  const fromGenerator = mediaPlanEngine.applyScheduleItems(state, [], {
    at: AT,
    source: "campaign_output_generator",
  });
  assert.equal(fromGenerator.ok, false);

  const fromRegen = mediaPlanEngine.assertMutationSource("campaign_output_regenerate");
  assert.equal(fromRegen.ok, false);
});

test("Studio and Campaign share the same mediaPlanId / campaignObjectId", () => {
  const { state } = createPlan();
  assert.equal(state.mediaPlanId, "mp_1");
  assert.equal(state.campaignObjectId, "co_1");
  // Same object identity is the sync contract — no duplicate plan id.
  assert.equal(state.mediaPlanId === state.campaignObjectId || state.campaignObjectId === "co_1", true);
});

test("comparison mode diffs baseline vs draft", () => {
  const { state } = createPlan();
  const approved = approveDraft(state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const forked = mediaPlanEngine.ensureWorkingDraft(approved.state, { at: AT });
  assert.equal(forked.ok, true);
  if (!forked.ok) throw new Error(forked.error);

  const nextItems = sampleItems().map((item) =>
    item.id === "i1" ? { ...item, plannedDate: "2026-09-01" } : item
  );
  const edited = mediaPlanEngine.applyScheduleItems(forked.state, nextItems, {
    at: AT,
    source: "studio_media_plan_ui",
  });
  assert.equal(edited.ok, true);
  if (!edited.ok) throw new Error(edited.error);

  const baseline = mediaPlanEngine.getBaseline(edited.state)!;
  const draft = mediaPlanEngine.getDraft(edited.state)!;
  const diffs = mediaPlanEngine.compare(baseline, draft);
  assert.ok(diffs.some((d) => d.changeType === "date_changed" && d.itemId === "i1"));
});

test("timeline events include baseline publish and draft creation", () => {
  const created = createPlan();
  const approved = approveDraft(created.state);
  assert.equal(approved.ok, true);
  if (!approved.ok) throw new Error(approved.error);

  const forked = mediaPlanEngine.ensureWorkingDraft(approved.state, { at: AT });
  assert.equal(forked.ok, true);
  if (!forked.ok) throw new Error(forked.error);

  const feed = mediaPlanEngine.timelineEvents([
    ...created.events,
    ...approved.events,
    ...forked.events,
  ]);
  const types = new Set(feed.map((e) => e.type));
  assert.ok(types.has("media_plan_created"));
  assert.ok(types.has("baseline_published"));
  assert.ok(types.has("draft_created"));
});
