import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  generateDeliverable,
  getDeliverable,
  listDeliverables,
  markStaleDeliverables,
  staleDeliverableKinds,
} from "./deliverable-registry";
import { buildCampaignObjectFixture } from "./deliverable-test-fixture";

test("backward compat: no meta.deliverables lists everything as not_generated", () => {
  const obj = buildCampaignObjectFixture();
  const views = listDeliverables(obj);
  assert.ok(views.length > 5);
  assert.ok(views.every((v) => v.status === "not_generated" && v.version === 0));
  // Media Plan + Full Strategy are generatable in this increment.
  assert.equal(views.find((v) => v.kind === "media_plan")?.generatable, true);
  assert.equal(views.find((v) => v.kind === "full_strategy")?.generatable, true);
  assert.equal(views.find((v) => v.kind === "kpi_forecast")?.generatable, false);
});

test("generate sets status generated at version 1 with a cached view", () => {
  const obj = buildCampaignObjectFixture();
  const { campaignObject, record } = generateDeliverable(obj, "media_plan");
  assert.equal(record.status, "generated");
  assert.equal(record.version, 1);
  assert.ok(record.sourceFingerprint);
  assert.ok(record.content && record.content.sections.length > 0);
  assert.equal(getDeliverable(campaignObject, "media_plan")?.status, "generated");
});

test("regenerating bumps the version and keeps generatedAt", () => {
  const obj = buildCampaignObjectFixture();
  const first = generateDeliverable(obj, "media_plan", { now: "2026-01-01T00:00:00.000Z" });
  const second = generateDeliverable(first.campaignObject, "media_plan", {
    now: "2026-02-01T00:00:00.000Z",
  });
  assert.equal(second.record.version, 2);
  assert.equal(second.record.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(second.record.updatedAt, "2026-02-01T00:00:00.000Z");
});

test("dependency graph: changing creators flips only dependent deliverables to needs_update", () => {
  const obj = buildCampaignObjectFixture();
  // Generate two deliverables with different input dependencies.
  const withMedia = generateDeliverable(obj, "media_plan").campaignObject;
  const withBoth = generateDeliverable(withMedia, "full_strategy").campaignObject;

  // Change the creator slate (media_plan and full_strategy both depend on creators).
  const edited = buildCampaignObjectFixture({
    creators: [{ id: "cr_new", name: "New Face", tier: "Micro" }],
  });
  // Carry over the generated registry onto the edited object.
  const editedWithRegistry = {
    ...edited,
    meta: { ...edited.meta, deliverables: withBoth.meta.deliverables },
  };

  const stale = markStaleDeliverables(editedWithRegistry);
  assert.equal(getDeliverable(stale, "media_plan")?.status, "needs_update");
  assert.equal(getDeliverable(stale, "full_strategy")?.status, "needs_update");
  assert.deepEqual(new Set(staleDeliverableKinds(stale)), new Set(["media_plan", "full_strategy"]));
});

test("dependency graph: an input change that a deliverable does not depend on leaves it generated", () => {
  const obj = buildCampaignObjectFixture();
  // media_plan depends on creators/platforms/timeline/deliverables_scope — NOT audience.
  const withMedia = generateDeliverable(obj, "media_plan").campaignObject;

  const edited = buildCampaignObjectFixture({ facts: { audience: "A completely different audience" } });
  const editedWithRegistry = {
    ...edited,
    meta: { ...edited.meta, deliverables: withMedia.meta.deliverables },
  };

  const stale = markStaleDeliverables(editedWithRegistry);
  assert.equal(getDeliverable(stale, "media_plan")?.status, "generated");
});

test("markStaleDeliverables is idempotent when nothing changed", () => {
  const obj = buildCampaignObjectFixture();
  const withMedia = generateDeliverable(obj, "media_plan").campaignObject;
  const again = markStaleDeliverables(withMedia);
  // No input changed → same object reference back.
  assert.equal(again, withMedia);
});

test("generating an unwired deliverable throws", () => {
  const obj = buildCampaignObjectFixture();
  assert.throws(() => generateDeliverable(obj, "kpi_forecast"), /No generator/);
});
