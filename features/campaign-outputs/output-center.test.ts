import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  compareOutputVersions,
  describeStaleReason,
  generateCampaignOutput,
  getOutputVersions,
  listCampaignOutputs,
  listCampaignOutputsByGroup,
  restoreOutputVersion,
} from "./output-registry";
import { buildCampaignObjectFixture } from "./output-test-fixture";

function carryRegistry(base: ReturnType<typeof buildCampaignObjectFixture>, from: ReturnType<typeof buildCampaignObjectFixture>) {
  return { ...base, meta: { ...base.meta, campaignOutputs: from.meta.campaignOutputs } };
}

test("views carry Center metadata: group, estimated time, origin, size", () => {
  const obj = buildCampaignObjectFixture();
  const generated = generateCampaignOutput(obj, "media_plan", { origin: "copilot" }).campaignObject;
  const media = listCampaignOutputs(generated).find((v) => v.kind === "media_plan")!;
  assert.equal(media.group, "planning");
  assert.ok(media.estimatedGenerationMs > 0);
  assert.equal(media.origin, "copilot");
  assert.ok((media.sizeBytes ?? 0) > 0);
});

test("outputs group by the metadata-driven Strategy/Planning/Client/Internal buckets", () => {
  const groups = listCampaignOutputsByGroup(buildCampaignObjectFixture());
  const byGroup = Object.fromEntries(groups.map((g) => [g.group, g.outputs.map((o) => o.kind)]));
  assert.ok(byGroup.strategy.includes("full_strategy"));
  assert.ok(byGroup.planning.includes("media_plan"));
  assert.ok(byGroup.client.includes("executive_proposal"));
  assert.ok(byGroup.internal.includes("internal_operations"));
  // Every catalog output lands in exactly one group.
  const total = groups.reduce((n, g) => n + g.outputs.length, 0);
  assert.equal(total, listCampaignOutputs(buildCampaignObjectFixture()).length);
});

test("stale reason names the exact input that changed — never generic", () => {
  const obj = buildCampaignObjectFixture();
  const generated = generateCampaignOutput(obj, "media_plan").campaignObject;

  const editedCreators = carryRegistry(
    buildCampaignObjectFixture({ creators: [{ id: "x", name: "X", tier: "Micro" }] }),
    generated
  );
  assert.equal(describeStaleReason(editedCreators, "media_plan")?.reason, "Creator slate changed.");

  const editedTimeline = carryRegistry(
    buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }),
    generated
  );
  assert.equal(describeStaleReason(editedTimeline, "media_plan")?.reason, "Timeline changed.");
});

test("stale reason surfaces in the list view for needs_update outputs", () => {
  const obj = buildCampaignObjectFixture();
  const generated = generateCampaignOutput(obj, "media_plan").campaignObject;
  const edited = carryRegistry(buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }), generated);
  const view = listCampaignOutputs(edited).find((v) => v.kind === "media_plan")!;
  assert.equal(view.status, "needs_update");
  assert.equal(view.staleReason, "Timeline changed.");
});

test("stale reason works when stored output status is already needs_update", () => {
  const obj = buildCampaignObjectFixture();
  const generated = generateCampaignOutput(obj, "media_plan").campaignObject;
  const edited = carryRegistry(buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }), generated);
  const state = edited.meta.campaignOutputs!;
  const media = state.media_plan!;
  const marked = {
    ...edited,
    meta: {
      ...edited.meta,
      campaignOutputs: {
        ...state,
        media_plan: { ...media, status: "needs_update" as const },
      },
    },
  };
  const view = listCampaignOutputs(marked).find((v) => v.kind === "media_plan")!;
  assert.equal(view.status, "needs_update");
  assert.equal(view.staleReason, "Timeline changed.");
});

test("initial generation records a reason and no history; regeneration records the trigger", () => {
  const obj = buildCampaignObjectFixture();
  const first = generateCampaignOutput(obj, "media_plan");
  assert.equal(first.record.changeReason, "Initial generation.");
  assert.equal(first.record.history?.length ?? 0, 0);

  const edited = carryRegistry(buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }), first.campaignObject);
  const second = generateCampaignOutput(edited, "media_plan");
  assert.equal(second.record.version, 2);
  assert.equal(second.record.changeReason, "Timeline changed.");
  assert.equal(second.record.history?.length, 1);
  assert.equal(second.record.history?.[0]?.version, 1);
});

test("compare defaults to the last two versions and reports section changes + reason", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const first = generateCampaignOutput(obj, "media_plan");
  const edited = carryRegistry(buildCampaignObjectFixture({ facts: { durationWeeks: 3 } }), first.campaignObject);
  const second = generateCampaignOutput(edited, "media_plan");

  const diff = compareOutputVersions(second.campaignObject, "media_plan");
  assert.ok(diff);
  assert.equal(diff!.fromVersion, 1);
  assert.equal(diff!.toVersion, 2);
  assert.equal(diff!.reason, "Timeline changed.");
  // Going from 6 weeks to 3 removes later week sections.
  assert.ok(diff!.removedSections.some((h) => h.startsWith("Week")));
});

test("restore brings an earlier version back as a new version, preserving history", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const first = generateCampaignOutput(obj, "media_plan");
  const edited = carryRegistry(buildCampaignObjectFixture({ facts: { durationWeeks: 3 } }), first.campaignObject);
  const second = generateCampaignOutput(edited, "media_plan");

  const restored = restoreOutputVersion(second.campaignObject, "media_plan", 1);
  assert.ok(restored);
  assert.equal(restored!.record.version, 3);
  assert.equal(restored!.record.changeReason, "Restored version 1.");
  // v3 content equals the v1 content (6-week plan).
  const v1 = getOutputVersions(second.campaignObject, "media_plan").find((v) => v.version === 1);
  assert.deepEqual(restored!.record.content, v1!.content);
});

test("getOutputVersions returns all versions ascending", () => {
  const obj = buildCampaignObjectFixture();
  const first = generateCampaignOutput(obj, "media_plan");
  const edited = carryRegistry(buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }), first.campaignObject);
  const second = generateCampaignOutput(edited, "media_plan");
  const versions = getOutputVersions(second.campaignObject, "media_plan").map((v) => v.version);
  assert.deepEqual(versions, [1, 2]);
});
