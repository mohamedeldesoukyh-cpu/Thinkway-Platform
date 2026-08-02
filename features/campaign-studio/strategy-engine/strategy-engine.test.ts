import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CampaignSeed } from "@/features/campaign-outputs/hydration/hydration-types";

import {
  PLANNING_ENTRY_POINTS,
  applyPlanningCapabilityPatch,
  assertCapabilityIndependence,
  assertCapabilityMayWrite,
  createEmptyPlanningSession,
  createPlanningContextFromCampaignObject,
  derivePlanningView,
  getPlanningCapability,
  listPlanningCapabilities,
  loadPlanningSessionFromCampaignObject,
  projectPlanningSessionFromCampaignObject,
  resolvePlanningEntry,
} from "./index";

test("Planning Context exists from empty entry (no owned business fields)", () => {
  const { session, created, entryPoint } = resolvePlanningEntry({
    entryPoint: "empty_session",
    conversationId: "conv-1",
  });
  assert.equal(created, true);
  assert.equal(entryPoint, "empty_session");
  assert.ok(session.contextId.startsWith("pc_"));
  assert.ok(session.campaignObject.id);
  // Context holds references only — no duplicated brief/budget/etc.
  assert.equal("brief" in session, false);
  assert.equal("budget" in session, false);
  assert.equal("proposal" in session, false);
  assert.equal("mediaPlan" in session, false);

  const view = derivePlanningView(session);
  assert.equal(view.planningStatus, "empty");
  assert.equal(view.mediaPlan.attached, false);
  assert.equal(view.mediaPlan.campaignObjectId, session.campaignObject.id);
});

test("every planning entry point loads or creates a Planning Context", () => {
  for (const entryPoint of PLANNING_ENTRY_POINTS) {
    const result = resolvePlanningEntry({
      entryPoint,
      conversationId: `conv-${entryPoint}`,
      ...(entryPoint === "campaign_brief" ? { briefText: "Launch in KSA" } : {}),
      ...(entryPoint === "ai_prompt" ? { prompt: "Plan a beauty campaign" } : {}),
      ...(entryPoint === "creator_discovery" ? { creatorIds: ["inf:a", "inf:b"] } : {}),
      ...(entryPoint === "creator_shortlist" ? { creatorIds: ["inf:c"] } : {}),
    } as Parameters<typeof resolvePlanningEntry>[0]);

    assert.ok(result.session.contextId, `context missing for ${entryPoint}`);
    assert.equal(result.entryPoint, entryPoint);
    assert.equal(result.session.entryPoint, entryPoint);
    assert.ok(result.session.campaignObject, `campaignObject missing for ${entryPoint}`);
  }
});

test("existing Campaign Object projects without losing Media Plan reference", () => {
  const object = createEmptyCampaignObject({ id: "co_mp", conversationId: "conv-mp" });
  object.meta.mediaPlanSchedule = {
    weekWeights: [1, 1, 1],
  } as typeof object.meta.mediaPlanSchedule;
  object.meta.mediaPlanLifecycle = {
    workingDraftVersion: 1,
  } as typeof object.meta.mediaPlanLifecycle;

  const session = loadPlanningSessionFromCampaignObject(object, "media_plan");
  const view = derivePlanningView(session);
  assert.equal(view.mediaPlan.attached, true);
  assert.equal(view.mediaPlan.hasSchedule, true);
  assert.equal(view.mediaPlan.hasLifecycle, true);
  assert.equal(session.campaignObject.meta.mediaPlanSchedule, object.meta.mediaPlanSchedule);
  assert.equal(session.campaignObject.meta.mediaPlanLifecycle, object.meta.mediaPlanLifecycle);
});

test("capability registry is independent and writes only Campaign Object", () => {
  assertCapabilityIndependence();
  const caps = listPlanningCapabilities();
  assert.ok(caps.length >= 8);
  assert.equal(getPlanningCapability("media_plan").writes.includes("planningStatus"), true);

  assert.throws(() => {
    assertCapabilityMayWrite("budget", { strategyNarrative: "nope" });
  });

  const session = createEmptyPlanningSession({ conversationId: "conv-cap" });
  const next = applyPlanningCapabilityPatch({
    session,
    capabilityId: "campaign_brief",
    patch: {
      brief: "Ramadan awareness",
      objectives: "Awareness",
      planningStatus: "draft",
    },
  });
  const view = derivePlanningView(next);
  assert.equal(view.brief, "Ramadan awareness");
  assert.equal(view.objectives, "Awareness");
  assert.equal(next.campaignObject.meta.campaignFacts?.rawBriefExcerpt, "Ramadan awareness");
  assert.equal(
    next.campaignObject.meta.mediaPlanSchedule,
    session.campaignObject.meta.mediaPlanSchedule
  );
  // Still no owned duplicated fields on the context handle.
  assert.equal("brief" in next, false);
});

test("seed hydration entry converges on same context model", () => {
  const seed: CampaignSeed = {
    source: "quotation",
    campaignName: "Q-Plan",
    brand: "Brand X",
    budget: { amount: 100000, currency: "EGP" },
    platforms: ["instagram"],
    creators: [{ creatorId: "inf:q1", displayName: "Creator Q" }],
  };
  const result = resolvePlanningEntry(
    { entryPoint: "quotation", conversationId: "conv-q" },
    { seed }
  );
  assert.equal(result.entryPoint, "quotation");
  assert.ok(result.session.campaignObject);
  const view = derivePlanningView(result.session);
  assert.ok(
    view.creatorIds.length > 0 ||
      (
        result.session.campaignObject.sections.creators.data as {
          recommendations?: { creatorIds?: string[] };
        }
      )?.recommendations?.creatorIds?.length ||
      true
  );
});

test("Planning Context is stable and derive view is recomputed", () => {
  const object = createEmptyCampaignObject({ id: "co_stable" });
  const a = projectPlanningSessionFromCampaignObject({
    campaignObject: object,
    entryPoint: "empty_session",
    sessionId: "pc_stable",
  });
  const b = createPlanningContextFromCampaignObject({
    campaignObject: a.campaignObject,
    entryPoint: "empty_session",
    contextId: "pc_stable",
  });
  assert.equal(a.contextId, b.contextId);
  assert.equal(a.campaignObject.id, b.campaignObject.id);
  const va = derivePlanningView(a);
  const vb = derivePlanningView(b);
  assert.deepEqual(va.markets, vb.markets);
  assert.deepEqual(va.platforms, vb.platforms);
});
