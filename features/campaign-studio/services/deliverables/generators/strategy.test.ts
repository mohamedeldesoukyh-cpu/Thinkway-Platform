import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generateFullStrategy } from "./strategy";
import { buildCampaignObjectFixture } from "../deliverable-test-fixture";

test("full strategy includes the standard strategy sections", () => {
  const obj = buildCampaignObjectFixture();
  const content = generateFullStrategy(obj);
  const headings = content.sections.map((s) => s.heading);
  for (const required of [
    "Executive Summary",
    "Campaign Objectives",
    "Audience Strategy",
    "Creator Strategy",
    "Platform Strategy",
    "Budget Allocation",
    "Risk Assessment",
    "Recommendations",
  ]) {
    assert.ok(headings.includes(required), `expected section: ${required}`);
  }
});

test("creator strategy reflects the actual tier mix", () => {
  const obj = buildCampaignObjectFixture();
  const content = generateFullStrategy(obj);
  const creatorSection = content.sections.find((s) => s.heading === "Creator Strategy");
  assert.ok(creatorSection?.items?.some((i) => /Celebrity/.test(i)));
  assert.ok(creatorSection?.items?.some((i) => /Macro/.test(i)));
});

test("strategy derives from facts without inventing a budget", () => {
  const obj = buildCampaignObjectFixture({ facts: { budget: undefined } });
  const content = generateFullStrategy(obj);
  assert.ok(!content.sections.some((s) => s.heading === "Budget Allocation"));
});
