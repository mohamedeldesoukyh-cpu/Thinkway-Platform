import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignStudioSectionId } from "../types/campaign-studio";

import {
  STUDIO_LAYOUT,
  STUDIO_STORY_ARC,
  groupSectionsByStoryPhase,
} from "./studio-layout";
import {
  STUDIO_WORKSPACE_FOLDED_SECTIONS,
  STUDIO_WORKSPACE_STEPS,
  isPrimaryWorkspaceSection,
  workspaceStepForSection,
} from "./studio-workspace";

const ALL_SECTION_IDS: CampaignStudioSectionId[] = [
  "campaign-summary",
  "executive-strategy",
  "creator-discovery",
  "creator-recommendations",
  "budget-planner",
  "timeline",
  "kpi-forecast",
  "risk-analysis",
  "creative-concepts",
  "content-plan",
  "creator-mix",
  "why-ai",
  "industry-benchmark",
  "success-probability",
  "opportunity-finder",
  "executive-summary",
  "presentation-status",
];

test("primary workspace is six planning steps", () => {
  assert.deepEqual(
    STUDIO_WORKSPACE_STEPS.map((step) => step.id),
    ["intake", "strategy", "creators", "content", "commercial", "package"]
  );
  assert.deepEqual(
    STUDIO_STORY_ARC.map((phase) => phase.id),
    ["intake", "strategy", "creators", "content", "commercial", "package"]
  );
});

test("every layout section is either primary or explicitly folded", () => {
  const layoutIds = Object.values(STUDIO_LAYOUT).flat();
  assert.deepEqual([...layoutIds].sort(), [...ALL_SECTION_IDS].sort());

  const folded = new Set(STUDIO_WORKSPACE_FOLDED_SECTIONS.map((item) => item.id));
  const primary = new Set(STUDIO_WORKSPACE_STEPS.flatMap((step) => step.sections));

  for (const id of ALL_SECTION_IDS) {
    assert.ok(
      primary.has(id) || folded.has(id),
      `${id} must be a primary workspace section or an explicit fold`
    );
    assert.equal(primary.has(id) && folded.has(id), false, `${id} cannot be both primary and folded`);
  }
});

test("folded cards are not dumped into Package", () => {
  const primaryIds = STUDIO_STORY_ARC.flatMap((phase) => phase.sections);
  assert.ok(!primaryIds.includes("executive-summary"));
  assert.ok(!primaryIds.includes("kpi-forecast"));
  assert.ok(!primaryIds.includes("why-ai"));
  assert.ok(!primaryIds.includes("creator-mix"));
  assert.equal(workspaceStepForSection("executive-strategy"), "strategy");
  assert.equal(workspaceStepForSection("creator-recommendations"), "creators");
  assert.equal(workspaceStepForSection("content-plan"), "content");
  assert.equal(workspaceStepForSection("budget-planner"), "commercial");
  assert.equal(workspaceStepForSection("timeline"), "package");
  assert.equal(workspaceStepForSection("kpi-forecast"), null);
});

test("grouping renders only primary sections and skips empty steps", () => {
  const incoming = ALL_SECTION_IDS.map((id) => ({ id }));
  const phases = groupSectionsByStoryPhase(incoming);
  const rendered = phases.flatMap((p) => p.sections.map((s) => s.id));

  assert.equal(phases[0]?.id, "intake");
  assert.equal(phases[0]?.label, "Intake");
  assert.deepEqual(
    rendered,
    STUDIO_WORKSPACE_STEPS.flatMap((step) => [...step.sections])
  );
  assert.ok(!rendered.includes("kpi-forecast"));
  assert.ok(!rendered.includes("executive-summary"));

  const partial = groupSectionsByStoryPhase([{ id: "budget-planner" as const }]);
  assert.equal(partial.length, 1);
  assert.equal(partial[0]?.id, "commercial");
});

test("unmapped section ids are omitted from the primary rail", () => {
  const phases = groupSectionsByStoryPhase([
    { id: "campaign-summary" as CampaignStudioSectionId },
    { id: "future-section" as CampaignStudioSectionId },
  ]);
  const rendered = phases.flatMap((p) => p.sections.map((s) => s.id));
  assert.ok(rendered.includes("campaign-summary"));
  assert.ok(!rendered.includes("future-section" as CampaignStudioSectionId));
  assert.equal(isPrimaryWorkspaceSection("campaign-summary"), true);
  assert.equal(isPrimaryWorkspaceSection("opportunity-finder"), false);
});
