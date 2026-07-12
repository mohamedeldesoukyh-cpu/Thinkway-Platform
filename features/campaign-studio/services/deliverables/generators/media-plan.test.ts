import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generateMediaPlan, type MediaPlanData } from "./media-plan";
import { buildCampaignObjectFixture } from "../deliverable-test-fixture";

function planData(content: ReturnType<typeof generateMediaPlan>): MediaPlanData {
  return content.data as unknown as MediaPlanData;
}

test("media plan has one week per campaign week, each with 7 days", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.durationWeeks, 6);
  assert.equal(data.weeks.length, 6);
  assert.ok(data.weeks.every((w) => w.days.length === 7));
});

test("every creator appears on the publishing calendar", () => {
  const obj = buildCampaignObjectFixture();
  const data = planData(generateMediaPlan(obj));
  const scheduledCreators = new Set(
    data.weeks.flatMap((w) => w.days.filter((d) => d.creator).map((d) => d.creator))
  );
  for (const name of ["Nour Star", "Layla Macro", "Omar Macro", "Sara Micro"]) {
    assert.ok(scheduledCreators.has(name), `expected ${name} to be scheduled`);
  }
});

test("content days lead with higher-tier creators as Reels", () => {
  const obj = buildCampaignObjectFixture();
  const data = planData(generateMediaPlan(obj));
  // Monday of week 1 should be the Celebrity, formatted as a Reel.
  const monday = data.weeks[0]!.days[0]!;
  assert.equal(monday.type, "content");
  assert.equal(monday.creator, "Nour Star");
  assert.match(monday.label, /Reel/);
});

test("recurring rhythm: Thursday stories, Saturday boost, Sunday monitoring", () => {
  const obj = buildCampaignObjectFixture();
  const data = planData(generateMediaPlan(obj));
  const week1 = data.weeks[0]!;
  assert.equal(week1.days[3]!.type, "stories");
  assert.equal(week1.days[5]!.type, "boost");
  assert.equal(week1.days[6]!.type, "monitoring");
});

test("waves, milestones, and platform allocation are produced", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.waves.length, 3);
  assert.ok(data.milestones.some((m) => m.type === "client_approval"));
  assert.ok(data.milestones.some((m) => m.type === "optimization"));
  assert.ok(Object.keys(data.platformAllocation).length >= 1);
});

test("plan renders exportable sections", () => {
  const obj = buildCampaignObjectFixture();
  const content = generateMediaPlan(obj);
  assert.equal(content.title, "Media Plan");
  assert.ok(content.summary && content.summary.length > 0);
  const headings = content.sections.map((s) => s.heading);
  assert.ok(headings.some((h) => h.startsWith("Week 1")));
  assert.ok(headings.includes("Waves"));
  assert.ok(headings.includes("Milestones"));
});

test("degrades gracefully with no creators", () => {
  const obj = buildCampaignObjectFixture({ creators: [] });
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.creatorCount, 0);
  assert.ok(data.weeks.every((w) => w.days.length === 7));
});
