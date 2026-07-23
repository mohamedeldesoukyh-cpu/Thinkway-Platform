import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  generateCampaignOutput,
  getCampaignOutput,
  listCampaignOutputs,
  markStaleCampaignOutputs,
  regeneratableStaleCampaignOutputKinds,
  staleCampaignOutputKinds,
} from "./output-registry";
import { buildCampaignObjectFixture } from "./output-test-fixture";
import { MEDIA_PLAN_GENERATOR_VERSION } from "./generators/media-plan";

test("backward compat: no meta.campaignOutputs lists everything as not_generated", () => {
  const obj = buildCampaignObjectFixture();
  const views = listCampaignOutputs(obj);
  assert.ok(views.length > 5);
  assert.ok(views.every((v) => v.status === "not_generated" && v.version === 0));
  assert.equal(views.find((v) => v.kind === "media_plan")?.generatable, true);
  assert.equal(views.find((v) => v.kind === "full_strategy")?.generatable, true);
  assert.equal(views.find((v) => v.kind === "kpi_forecast")?.generatable, true);
  // posting_timeline is declared but not yet wired to a generator.
  assert.equal(views.find((v) => v.kind === "posting_timeline")?.generatable, false);
});

test("views expose source data, dependencies, and generator version", () => {
  const obj = buildCampaignObjectFixture();
  const media = listCampaignOutputs(obj).find((v) => v.kind === "media_plan")!;
  assert.deepEqual(media.sourceData, [
    "Campaign brief",
    "Creators",
    "Platforms",
    "Timeline",
    "Deliverables scope",
    "Market intelligence",
  ]);
  assert.deepEqual(media.dependencies, media.sourceData);
  assert.equal(media.generatorVersion, MEDIA_PLAN_GENERATOR_VERSION);
});

test("generate sets status generated at version 1 with a cached view + fingerprint", () => {
  const obj = buildCampaignObjectFixture();
  const { campaignObject, record } = generateCampaignOutput(obj, "media_plan");
  assert.equal(record.status, "generated");
  assert.equal(record.version, 1);
  assert.ok(record.sourceFingerprint);
  assert.equal(record.generatorVersion, MEDIA_PLAN_GENERATOR_VERSION);
  assert.ok(record.content && record.content.sections.length > 0);
  assert.equal(getCampaignOutput(campaignObject, "media_plan")?.status, "generated");
});

test("regenerating bumps the version and keeps generatedAt", () => {
  const obj = buildCampaignObjectFixture();
  const first = generateCampaignOutput(obj, "media_plan", { now: "2026-01-01T00:00:00.000Z" });
  const second = generateCampaignOutput(first.campaignObject, "media_plan", {
    now: "2026-02-01T00:00:00.000Z",
  });
  assert.equal(second.record.version, 2);
  assert.equal(second.record.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(second.record.updatedAt, "2026-02-01T00:00:00.000Z");
});

test("dependency graph: changing creators flips only dependent outputs to needs_update", () => {
  const obj = buildCampaignObjectFixture();
  const withMedia = generateCampaignOutput(obj, "media_plan").campaignObject;
  const withBoth = generateCampaignOutput(withMedia, "full_strategy").campaignObject;

  const edited = buildCampaignObjectFixture({
    creators: [{ id: "cr_new", name: "New Face", tier: "Micro" }],
  });
  const editedWithRegistry = {
    ...edited,
    meta: { ...edited.meta, campaignOutputs: withBoth.meta.campaignOutputs },
  };

  const stale = markStaleCampaignOutputs(editedWithRegistry);
  assert.equal(getCampaignOutput(stale, "media_plan")?.status, "needs_update");
  assert.equal(getCampaignOutput(stale, "full_strategy")?.status, "needs_update");
  assert.deepEqual(new Set(staleCampaignOutputKinds(stale)), new Set(["media_plan", "full_strategy"]));
});

test("dependency graph: an unrelated input change leaves an output generated", () => {
  const obj = buildCampaignObjectFixture();
  // media_plan depends on creators/platforms/timeline/deliverables_scope — NOT audience.
  const withMedia = generateCampaignOutput(obj, "media_plan").campaignObject;
  const edited = buildCampaignObjectFixture({ facts: { audience: "A different audience" } });
  const editedWithRegistry = {
    ...edited,
    meta: { ...edited.meta, campaignOutputs: withMedia.meta.campaignOutputs },
  };
  const stale = markStaleCampaignOutputs(editedWithRegistry);
  assert.equal(getCampaignOutput(stale, "media_plan")?.status, "generated");
});

test("markStaleCampaignOutputs is idempotent when nothing changed", () => {
  const obj = buildCampaignObjectFixture();
  const withMedia = generateCampaignOutput(obj, "media_plan").campaignObject;
  assert.equal(markStaleCampaignOutputs(withMedia), withMedia);
});

test("regeneratable stale kinds follow catalog order and skip unwired generators", () => {
  const obj = buildCampaignObjectFixture();
  const withMedia = generateCampaignOutput(obj, "media_plan").campaignObject;
  const withBoth = generateCampaignOutput(withMedia, "full_strategy").campaignObject;

  const edited = buildCampaignObjectFixture({
    creators: [{ id: "cr_new", name: "New Face", tier: "Micro" }],
  });
  const editedWithRegistry = {
    ...edited,
    meta: { ...edited.meta, campaignOutputs: withBoth.meta.campaignOutputs },
  };

  const stale = markStaleCampaignOutputs(editedWithRegistry);
  const kinds = regeneratableStaleCampaignOutputKinds(stale);

  assert.deepEqual(kinds, ["full_strategy", "media_plan"]);
  assert.equal(kinds.includes("posting_timeline"), false);
});

test("generating an unwired output throws", () => {
  const obj = buildCampaignObjectFixture();
  assert.throws(() => generateCampaignOutput(obj, "posting_timeline"), /No generator/);
});
