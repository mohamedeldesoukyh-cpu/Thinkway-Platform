import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generateMediaPlan, type MediaPlanData } from "./media-plan";
import { buildCampaignObjectFixture } from "../output-test-fixture";

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
  const scheduled = new Set(
    data.weeks.flatMap((w) => w.days.filter((d) => d.creator).map((d) => d.creator))
  );
  for (const name of ["Nour Star", "Layla Macro", "Omar Macro", "Sara Micro"]) {
    assert.ok(scheduled.has(name), `expected ${name} to be scheduled`);
  }
});

test("content days lead with higher-tier creators as Reels", () => {
  const obj = buildCampaignObjectFixture();
  const data = planData(generateMediaPlan(obj));
  const monday = data.weeks[0]!.days[0]!;
  assert.equal(monday.type, "content");
  assert.equal(monday.creator, "Nour Star");
  assert.match(monday.label, /Reel/);
});

test("recurring rhythm: Thursday stories, Saturday boost, Sunday monitoring", () => {
  const obj = buildCampaignObjectFixture();
  const week1 = planData(generateMediaPlan(obj)).weeks[0]!;
  assert.equal(week1.days[3]!.type, "stories");
  assert.equal(week1.days[5]!.type, "boost");
  assert.equal(week1.days[6]!.type, "monitoring");
});

test("agency-grade fields: waves, milestones/windows, dependencies, deadlines, allocation", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.waves.length, 3);
  assert.ok(data.milestones.some((m) => m.type === "client_approval"));
  assert.ok(data.milestones.some((m) => m.type === "optimization"));
  assert.ok(data.milestones.some((m) => m.type === "amplification"));
  assert.ok(data.milestones.some((m) => m.type === "contingency"));
  assert.ok(data.dependencies.length >= 1);
  assert.ok(data.deadlines.length >= 1);
  assert.ok(data.deadlines.every((d) => d.productionStart && d.assetDelivery));
  assert.ok(Object.keys(data.platformAllocation).length >= 1);
});

test("plan renders exportable sections including the deadline table", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  assert.equal(content.title, "Media Plan");
  const headings = content.sections.map((s) => s.heading);
  assert.ok(headings.some((h) => h.startsWith("Week 1")));
  assert.ok(headings.includes("Activation Waves"));
  assert.ok(headings.includes("Milestones & Windows"));
  const deadlineSection = content.sections.find((s) => s.heading.includes("Deadlines"));
  assert.ok(deadlineSection?.table);
});

test("degrades gracefully with no creators", () => {
  const data = planData(generateMediaPlan(buildCampaignObjectFixture({ creators: [] })));
  assert.equal(data.creatorCount, 0);
  assert.ok(data.weeks.every((w) => w.days.length === 7));
});
