import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { generateMediaPlan, enrichMediaPlanFromSlate, enrichMediaPlanCampaignContext, wantsPaidAmplification, type MediaPlanData } from "./media-plan";
import { resolveSlate } from "../output-inputs";
import { buildCampaignObjectFixture } from "../output-test-fixture";

function planData(content: ReturnType<typeof generateMediaPlan>): MediaPlanData {
  return content.data as unknown as MediaPlanData;
}

function withQuotationCreators(obj: ReturnType<typeof buildCampaignObjectFixture>) {
  const data = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = data.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceLabel = "1× IG Reel";
    reasoning[0].serviceTypes = ["1× IG Reel"];
    reasoning[0].avatarUrl = "https://cdn.example/nour.jpg";
    reasoning[0].quotedRevenue = 120_000;
    reasoning[0].quotedCurrency = "EGP";
  }
  return obj;
}

test("media plan has one week per campaign week, each with 7 days", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.durationWeeks, 6);
  assert.equal(data.weeks.length, 6);
  assert.ok(data.weeks.every((w) => w.days.length === 7));
});

test("quotation calendar shows all ad types on each creator card", () => {
  const obj = withQuotationCreators(buildCampaignObjectFixture({ facts: { durationWeeks: 2 } }));
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel", "1× IG Set of stories", "1× Mirrored IG"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
  }

  const data = planData(generateMediaPlan(obj));
  const nourDays = data.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.creator === "Nour Star");

  assert.ok(nourDays.length >= 1);
  assert.deepEqual(nourDays[0]!.serviceTypes, [
    "1× IG Reel",
    "1× IG Set of stories",
    "1× Mirrored IG",
  ]);
  assert.ok(data.serviceTypes.includes("1× IG Reel"));
  assert.ok(data.serviceTypes.includes("1× Mirrored IG"));
  assert.ok((data.postingSlotCount ?? 0) >= 3);
});

test("quotation campaigns exclude paid amplification milestones", () => {
  const obj = withQuotationCreators(buildCampaignObjectFixture({ facts: { durationWeeks: 6 } }));
  const data = planData(generateMediaPlan(obj));
  assert.ok(!data.milestones.some((m) => m.type === "amplification"));
  assert.equal(wantsPaidAmplification(obj, resolveSlate(obj)), false);
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

test("agency-grade fields: waves, milestones/windows, dependencies, deadlines, allocation", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 6 } });
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.waves.length, 3);
  assert.ok(data.milestones.some((m) => m.type === "client_approval"));
  assert.ok(data.milestones.some((m) => m.type === "review"));
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

test("media plan days carry short calendar date labels", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 2 } });
  const data = planData(generateMediaPlan(obj));
  assert.ok(data.campaignStartDate);
  const monday = data.weeks[0]!.days[0]!;
  assert.ok(monday.dateLabel && /^\d{1,2}\/\d{1,2}\/\d{2}$/.test(monday.dateLabel));
});

test("enrichMediaPlanFromSlate patches avatars and quotation ad types onto legacy calendar cells", () => {
  const obj = buildCampaignObjectFixture();
  const data = planData(generateMediaPlan(obj));
  const legacy: MediaPlanData = {
    ...data,
    weeks: data.weeks.map((week, weekIndex) =>
      weekIndex === 0
        ? {
            ...week,
            days: week.days.map((day, dayIndex) =>
              dayIndex === 0
                ? {
                    day: day.day,
                    dateLabel: day.dateLabel,
                    type: "content" as const,
                    label: "Nour Star",
                    creator: "Nour Star",
                  }
                : day
            ),
          }
        : week
    ),
    serviceTypes: [],
  };

  const enriched = enrichMediaPlanFromSlate(legacy, [
    {
      creatorId: "cr_star",
      displayName: "Nour Star",
      serviceTypes: ["1× IG Reel"],
      serviceLabel: "1× IG Reel",
      avatarUrl: "https://cdn.example/nour.jpg",
      profileUrl: "https://instagram.com/nour",
      platform: "Instagram",
    },
  ]);

  const monday = enriched.weeks[0]!.days[0]!;
  assert.equal(monday.serviceType, "1× IG Reel");
  assert.deepEqual(monday.serviceTypes, ["1× IG Reel"]);
  assert.equal(monday.avatarUrl, "https://cdn.example/nour.jpg");
  assert.ok(enriched.serviceTypes.includes("1× IG Reel"));
  assert.ok(
    enriched.deadlines.some((d) => d.avatarUrl === "https://cdn.example/nour.jpg")
  );
});

test("media plan embeds campaign context from quotation commercials meta", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.quotationCommercials = {
    syncedAt: new Date().toISOString(),
    creators: [],
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
    agencyOrDirect: "agency",
    agencyName: "Media Agency Egypt",
  };
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.campaignContext?.brandName, "Dolphin Tuna");
  assert.equal(data.campaignContext?.groupName, "Food Group");
  assert.equal(data.campaignContext?.agencyName, "Media Agency Egypt");
});

test("enrichMediaPlanCampaignContext fills group and agency from live quotation commercials", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.quotationCommercials = {
    syncedAt: new Date().toISOString(),
    creators: [],
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
    agencyOrDirect: "agency",
    agencyName: "Media Agency Egypt",
  };

  const cached: MediaPlanData = {
    ...planData(generateMediaPlan(buildCampaignObjectFixture())),
    campaignContext: { brandName: "Dolphin Tuna" },
  };

  const enriched = enrichMediaPlanCampaignContext(cached, obj);
  assert.equal(enriched.campaignContext?.brandName, "Dolphin Tuna");
  assert.equal(enriched.campaignContext?.groupName, "Food Group");
  assert.equal(enriched.campaignContext?.agencyName, "Media Agency Egypt");
});

test("enrichMediaPlanCampaignContext omits agency when client is direct", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.quotationCommercials = {
    syncedAt: new Date().toISOString(),
    creators: [],
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
    agencyOrDirect: "direct",
    agencyName: "Should Not Show",
  };

  const enriched = enrichMediaPlanCampaignContext(
    { ...planData(generateMediaPlan(obj)), campaignContext: { brandName: "Dolphin Tuna" } },
    obj
  );
  assert.equal(enriched.campaignContext?.groupName, "Food Group");
  assert.equal(enriched.campaignContext?.agencyName, undefined);
});

test("resolveMediaPlanCampaignContext reads group from quotation commercials without creators", () => {
  const obj = buildCampaignObjectFixture();
  obj.meta.quotationCommercials = {
    syncedAt: new Date().toISOString(),
    creators: [],
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
    agencyOrDirect: "agency",
    agencyName: "Media Agency Egypt",
  };

  const context = enrichMediaPlanCampaignContext(
    planData(generateMediaPlan(buildCampaignObjectFixture())),
    obj
  ).campaignContext;

  assert.equal(context?.brandName, "Dolphin Tuna");
  assert.equal(context?.groupName, "Food Group");
  assert.equal(context?.agencyName, "Media Agency Egypt");
});

test("deadlines carry creator ids for avatar enrichment", () => {
  const data = planData(generateMediaPlan(buildCampaignObjectFixture()));
  assert.ok(data.deadlines.length >= 1);
  assert.ok(data.deadlines.every((d) => d.creatorId && d.shortName));
});
