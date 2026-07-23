import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import {
  defaultMediaPlanPresentation,
  filterStrategyBlocksByPresentation,
  mergeMediaPlanPresentation,
  resolveExportPresentation,
} from "@/features/campaign-outputs/media-plan-presentation";
import { buildMediaPlanStrategyBlocks } from "@/features/campaign-outputs/media-plan-strategy-blocks";
import { buildMediaPlanStrategySummary } from "@/features/campaign-outputs/media-plan-strategy-summary";

test("standard mode hides platform intelligence by default", () => {
  const config = defaultMediaPlanPresentation("standard");
  assert.equal(config.sections.platformIntelligence, false);
  assert.equal(config.sections.weeklyObjectives, false);
  assert.equal(config.sections.executiveSummary, true);
});

test("strategy mode enables all sections by default", () => {
  const config = defaultMediaPlanPresentation("strategy");
  assert.equal(config.sections.platformIntelligence, true);
  assert.equal(config.sections.marketTiming, true);
});

test("mergeMediaPlanPresentation preserves stored sections on initial read", () => {
  const stored = {
    ...defaultMediaPlanPresentation("strategy"),
    sections: {
      ...defaultMediaPlanPresentation("strategy").sections,
      platformIntelligence: false,
      productionSchedule: false,
    },
  };
  const merged = mergeMediaPlanPresentation(undefined, stored);
  assert.equal(merged.sections.platformIntelligence, false);
  assert.equal(merged.sections.productionSchedule, false);
});

test("mergeMediaPlanPresentation resets sections when mode changes", () => {
  const merged = mergeMediaPlanPresentation(defaultMediaPlanPresentation("standard"), {
    mode: "strategy",
  });
  assert.equal(merged.mode, "strategy");
  assert.equal(merged.sections.weeklyObjectives, true);
});

test("filterStrategyBlocksByPresentation removes hidden sections", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt: "Four-week skincare awareness in UAE with front-loaded week 1.",
      brandName: "Glow",
      objective: "Drive awareness among women 25-34",
      durationWeeks: 4,
      geography: ["UAE"],
    },
  });

  const summary = buildMediaPlanStrategySummary(object, { planMode: "strategy" });
  const blocks = buildMediaPlanStrategyBlocks(summary);
  assert.ok(blocks.length > 2);

  const standardConfig = defaultMediaPlanPresentation("standard");
  const filtered = filterStrategyBlocksByPresentation(blocks, standardConfig);

  assert.ok(!filtered.some((block) => block.label === "Platform Intelligence"));
  assert.ok(!filtered.some((block) => block.label === "Weekly Objectives"));
});

test("resolveExportPresentation defaults to stored internal view", () => {
  const object = buildCampaignObjectFixture();
  const resolved = resolveExportPresentation(object);
  assert.equal(resolved.view, "internal");
});

test("resolveExportPresentation respects stored section visibility for export", () => {
  const object = buildCampaignObjectFixture();
  object.meta.mediaPlanPresentation = {
    ...defaultMediaPlanPresentation("strategy"),
    sections: {
      ...defaultMediaPlanPresentation("strategy").sections,
      platformIntelligence: false,
      productionSchedule: false,
    },
  };

  const resolved = resolveExportPresentation(object);
  assert.equal(resolved.sections.platformIntelligence, false);
  assert.equal(resolved.sections.productionSchedule, false);
});
