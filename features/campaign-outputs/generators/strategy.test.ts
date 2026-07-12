import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generateFullStrategy } from "./strategy";
import { buildCampaignObjectFixture } from "../output-test-fixture";

test("full strategy includes the standard strategy sections", () => {
  const content = generateFullStrategy(buildCampaignObjectFixture());
  const headings = content.sections.map((s) => s.heading);
  for (const required of [
    "Executive Summary",
    "Campaign Objectives",
    "Audience Strategy",
    "Creator Strategy",
    "Platform Strategy",
    "Activation Phases & Timeline",
    "Creator Mix & Content Plan",
    "Budget Allocation",
    "Risk Assessment",
    "Recommendations",
  ]) {
    assert.ok(headings.includes(required), `expected section: ${required}`);
  }
});

test("creator strategy reflects the actual tier mix", () => {
  const content = generateFullStrategy(buildCampaignObjectFixture());
  const creatorSection = content.sections.find((s) => s.heading === "Creator Strategy");
  assert.ok(creatorSection?.items?.some((i) => /Celebrity/.test(i)));
  assert.ok(creatorSection?.items?.some((i) => /Macro/.test(i)));
});

test("strategy derives from facts without inventing a budget", () => {
  const content = generateFullStrategy(buildCampaignObjectFixture({ facts: { budget: undefined } }));
  assert.ok(!content.sections.some((s) => s.heading === "Budget Allocation"));
});
