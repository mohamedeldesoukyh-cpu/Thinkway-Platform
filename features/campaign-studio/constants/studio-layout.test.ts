import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignStudioSectionId } from "../types/campaign-studio";

import {
  STUDIO_STORY_ARC,
  STUDIO_LAYOUT,
  groupSectionsByStoryPhase,
} from "./studio-layout";

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

test("every known section id is mapped to exactly one story phase", () => {
  const mapped = STUDIO_STORY_ARC.flatMap((p) => p.sections);
  assert.deepEqual([...mapped].sort(), [...ALL_SECTION_IDS].sort());
  assert.equal(new Set(mapped).size, mapped.length);
});

test("story arc covers the same ids as the layout lookup", () => {
  const layoutIds = Object.values(STUDIO_LAYOUT).flat();
  const arcIds = STUDIO_STORY_ARC.flatMap((p) => p.sections);
  assert.deepEqual([...layoutIds].sort(), [...arcIds].sort());
});

test("grouping preserves every section, orders by arc, and skips empty phases", () => {
  const incoming = ALL_SECTION_IDS.map((id) => ({ id }));
  const phases = groupSectionsByStoryPhase(incoming);

  const rendered = phases.flatMap((p) => p.sections.map((s) => s.id));
  assert.equal(rendered.length, ALL_SECTION_IDS.length);
  assert.equal(phases[0]?.sections[0]?.id, "campaign-summary");
  assert.equal(phases[0]?.label, "The Brief");

  // Partial section lists (streaming) never produce empty phase headers.
  const partial = groupSectionsByStoryPhase([{ id: "budget-planner" as const }]);
  assert.equal(partial.length, 1);
  assert.equal(partial[0]?.label, "The Plan");
});

test("unmapped section ids append to the final phase instead of being dropped", () => {
  const phases = groupSectionsByStoryPhase([
    { id: "campaign-summary" as CampaignStudioSectionId },
    { id: "future-section" as CampaignStudioSectionId },
  ]);
  const rendered = phases.flatMap((p) => p.sections.map((s) => s.id));
  assert.ok(rendered.includes("future-section" as CampaignStudioSectionId));
  assert.equal(phases[phases.length - 1]?.sections.at(-1)?.id, "future-section");
});
