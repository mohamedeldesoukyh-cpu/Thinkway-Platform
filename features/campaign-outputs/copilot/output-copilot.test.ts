import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  resolveOutputKind,
  runGenerateOutput,
  runExportOutput,
  runOpenOutput,
  runPreviewOutput,
  runExplainStaleness,
  runCompareVersions,
} from "./output-copilot";
import { generateCampaignOutput, getCampaignOutput } from "../output-registry";
import { buildCampaignObjectFixture } from "../output-test-fixture";

function carryRegistry(
  base: ReturnType<typeof buildCampaignObjectFixture>,
  from: ReturnType<typeof buildCampaignObjectFixture>
) {
  return { ...base, meta: { ...base.meta, campaignOutputs: from.meta.campaignOutputs } };
}

test("resolveOutputKind maps conversational phrasings to the right output", () => {
  assert.equal(resolveOutputKind("Generate a Media Plan."), "media_plan");
  assert.equal(resolveOutputKind("Create a Full Campaign Strategy"), "full_strategy");
  assert.equal(resolveOutputKind("Generate an Executive Proposal"), "executive_proposal");
  assert.equal(resolveOutputKind("Only regenerate the Timeline"), "posting_timeline");
  assert.equal(resolveOutputKind("Rebuild the KPI Forecast"), "kpi_forecast");
  assert.equal(resolveOutputKind("Generate a Risk Assessment"), "risk_plan");
  assert.equal(resolveOutputKind("Generate an Amplification Plan"), "amplification_plan");
  assert.equal(resolveOutputKind("Generate only the Executive Summary"), "executive_summary");
  assert.equal(resolveOutputKind("Generate Creative Concepts"), "creative_concepts");
  assert.equal(resolveOutputKind("do something unrelated"), undefined);
});

test("specific phrases win over the generic 'strategy'/'summary'", () => {
  assert.equal(resolveOutputKind("update the executive summary"), "executive_summary");
  assert.equal(resolveOutputKind("make the strategy"), "full_strategy");
});

test("generate creates the requested output and reports the source data", () => {
  const obj = buildCampaignObjectFixture();
  const result = runGenerateOutput(obj, { kind: "media_plan" });
  assert.equal(result.changed, true);
  assert.equal(result.record?.version, 1);
  assert.match(result.reply, /Media Plan/);
  assert.match(result.reply, /Only this output changed/);
  assert.equal(getCampaignOutput(result.campaignObject, "media_plan")?.status, "generated");
});

test("plain generate on an already-current output is a no-op (no unnecessary regeneration)", () => {
  const obj = buildCampaignObjectFixture();
  const first = runGenerateOutput(obj, { kind: "media_plan" });
  const again = runGenerateOutput(first.campaignObject, { kind: "media_plan" });
  assert.equal(again.changed, false);
  assert.match(again.reply, /already generated and current/);
});

test("regenerate always rebuilds and bumps the version", () => {
  const obj = buildCampaignObjectFixture();
  const first = runGenerateOutput(obj, { kind: "media_plan" });
  const regen = runGenerateOutput(first.campaignObject, { kind: "media_plan", regenerate: true });
  assert.equal(regen.changed, true);
  assert.equal(regen.record?.version, 2);
  assert.match(regen.reply, /regenerated/);
});

test("generating an unwired output is honest, not a silent no-op", () => {
  const obj = buildCampaignObjectFixture();
  const result = runGenerateOutput(obj, { kind: "kpi_forecast" });
  assert.equal(result.changed, false);
  assert.match(result.reply, /isn't wired up yet/);
});

test("export generates when needed and returns markdown", () => {
  const obj = buildCampaignObjectFixture();
  const result = runExportOutput(obj, { kind: "full_strategy" });
  assert.equal(result.changed, true);
  assert.ok(result.markdown && result.markdown.startsWith("# Full Campaign Strategy"));
  assert.match(result.reply, /ready to export/);
});

test("export of an already-generated, current output does not regenerate", () => {
  const obj = buildCampaignObjectFixture();
  const generated = runGenerateOutput(obj, { kind: "media_plan" }).campaignObject;
  const exported = runExportOutput(generated, { kind: "media_plan" });
  assert.equal(exported.changed, false);
  assert.ok(exported.markdown?.includes("Media Plan"));
});

test("open returns a navigation directive; suggests generating when absent", () => {
  const obj = buildCampaignObjectFixture();
  const notYet = runOpenOutput(obj, { kind: "media_plan" });
  assert.equal(notYet.navigate, "media_plan");
  assert.match(notYet.reply, /hasn't been generated/);

  const generated = runGenerateOutput(obj, { kind: "media_plan" }).campaignObject;
  const opened = runOpenOutput(generated, { kind: "media_plan" });
  assert.equal(opened.navigate, "media_plan");
  assert.match(opened.reply, /Opening/);
});

test("preview renders exportable content and sets the preview directive", () => {
  const obj = buildCampaignObjectFixture();
  const preview = runPreviewOutput(obj, { kind: "full_strategy" });
  assert.equal(preview.preview, "full_strategy");
  assert.ok(preview.markdown?.startsWith("# Full Campaign Strategy"));
});

test("explain staleness gives the precise reason, not a generic message", () => {
  const obj = buildCampaignObjectFixture();
  const generated = runGenerateOutput(obj, { kind: "media_plan" }).campaignObject;

  const upToDate = runExplainStaleness(generated, { kind: "media_plan" });
  assert.match(upToDate.reply, /up to date/);

  const edited = carryRegistry(buildCampaignObjectFixture({ creators: [{ id: "x", name: "X", tier: "Micro" }] }), generated);
  const stale = runExplainStaleness(edited, { kind: "media_plan" });
  assert.match(stale.reply, /needs updating/);
  assert.match(stale.reply, /Creator slate changed/);
});

test("compare versions summarizes the last two versions", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const first = generateCampaignOutput(obj, "media_plan");
  const edited = carryRegistry(buildCampaignObjectFixture({ facts: { durationWeeks: 3 } }), first.campaignObject);
  const second = generateCampaignOutput(edited, "media_plan");

  const compare = runCompareVersions(second.campaignObject, { kind: "media_plan" });
  assert.match(compare.reply, /v1 → v2/);
  assert.match(compare.reply, /Timeline changed/);
});

test("compare with only one version explains there is nothing to compare", () => {
  const obj = buildCampaignObjectFixture();
  const generated = runGenerateOutput(obj, { kind: "media_plan" }).campaignObject;
  const compare = runCompareVersions(generated, { kind: "media_plan" });
  assert.match(compare.reply, /only one version/);
});
