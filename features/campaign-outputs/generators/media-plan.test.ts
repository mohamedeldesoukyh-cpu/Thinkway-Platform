import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { generateMediaPlan, enrichMediaPlanFromSlate, enrichMediaPlanCampaignContext, wantsPaidAmplification, resolveCalendarWeekCount, type MediaPlanData } from "./media-plan";
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

test("quotation calendar groups all quoted ad types on the creator's assigned day", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 2 },
      creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
    })
  );
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

  assert.equal(nourDays.length, 1);
  assert.deepEqual(nourDays[0]!.serviceTypes, [
    "1× IG Reel",
    "1× IG Set of stories",
    "1× Mirrored IG",
  ]);
  assert.ok(data.serviceTypes.includes("1× IG Reel"));
  assert.ok(data.serviceTypes.includes("1× Mirrored IG"));
  assert.equal(data.postingSlotCount, 3);
});

test("quotation calendar keeps brief duration and packs deliverables across days", () => {
  const creators = Array.from({ length: 32 }, (_, index) => ({
    id: `cr_${index + 1}`,
    name: `Creator ${index + 1}`,
    tier: "Macro",
  }));
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 4 },
      creators,
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    entry.serviceTypes = ["1× IG Reel"];
    entry.serviceLabel = "1× IG Reel";
    entry.quotedRevenue = 5_000;
    entry.quotedCurrency = "EGP";
    entry.platform = "Instagram";
  }

  assert.equal(
    resolveCalendarWeekCount({ durationWeeks: 4, postingSlotCount: 32, quotationCalendar: true }),
    4
  );

  const data = planData(generateMediaPlan(obj));
  const scheduledDeliverables = data.weeks
    .flatMap((week) => week.days)
    .reduce((total, day) => {
      const primary = day.creator ? 1 : 0;
      const additional = day.additionalDeliverables?.length ?? 0;
      return total + primary + additional;
    }, 0);

  assert.equal(data.durationWeeks, 4);
  assert.equal(data.weeks.length, 4);
  assert.equal(data.postingSlotCount, 32);
  assert.equal(scheduledDeliverables, 32);
  assert.equal(data.unscheduledDeliverableCount, undefined);
});

test("many quoted lines keep one creator per day while platform allocation counts all lines", () => {
  const creators = Array.from({ length: 32 }, (_, index) => ({
    id: `cr_${index + 1}`,
    name: `Creator ${index + 1}`,
    tier: "Macro",
  }));
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 4 },
      creators,
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    entry.serviceTypes = ["1× IG Reel", "1× Mirrored IG", "1× TT Video"];
    entry.serviceLabel = entry.serviceTypes.join(" · ");
    entry.quotedRevenue = 5_000;
    entry.quotedCurrency = "EGP";
    entry.platform = "Instagram";
  }

  const data = planData(generateMediaPlan(obj));
  const scheduledCreators = data.weeks
    .flatMap((week) => week.days)
    .reduce(
      (total, day) =>
        total + (day.creator ? 1 : 0) + (day.additionalDeliverables?.length ?? 0),
      0
    );
  const creatorAppearances = new Set(
    data.weeks.flatMap((week) =>
      week.days.flatMap((day) => [
        ...(day.creator ? [day.creator] : []),
        ...(day.additionalDeliverables?.map((entry) => entry.creator) ?? []),
      ])
    )
  );

  assert.equal(data.weeks.length, 4);
  assert.equal(data.postingSlotCount, 96);
  assert.equal(scheduledCreators, 32);
  assert.equal(creatorAppearances.size, 32);
});

test("platform allocation totals match quoted posting slots, not calendar capacity", () => {
  const obj = withQuotationCreators(buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }));
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  for (const entry of reasoning) {
    entry.serviceTypes = ["1× IG Reel"];
    entry.serviceLabel = "1× IG Reel";
    entry.quotedRevenue = 10_000;
    entry.quotedCurrency = "EGP";
    entry.platform = entry.platform ?? "Instagram";
  }

  const data = planData(generateMediaPlan(obj));
  const allocationTotal = Object.values(data.platformAllocation).reduce((sum, count) => sum + count, 0);

  assert.equal(data.postingSlotCount, reasoning.length);
  assert.equal(allocationTotal, data.postingSlotCount);

  const allocationSection = generateMediaPlan(obj).sections.find((s) => s.heading === "Platform Allocation");
  assert.ok(allocationSection?.items?.some((item) => item.includes("quoted deliverables")));
});

test("multi-platform quotation lines split platform allocation by service type", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 2 },
      creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].platform = "TikTok";
    reasoning[0].serviceTypes = ["1× TT Video", "1× Mirrored IG"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
  }

  const data = planData(generateMediaPlan(obj));
  assert.equal(data.platformAllocation.TikTok, 1);
  assert.equal(data.platformAllocation.Instagram, 1);
  assert.equal(data.postingSlotCount, 2);
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
    clientName: "Dolphin Foods LLC",
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
    agencyOrDirect: "agency",
    agencyName: "Media Agency Egypt",
  };
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.campaignContext?.clientName, "Dolphin Foods LLC");
  assert.equal(data.campaignContext?.brandName, "Dolphin Tuna");
  assert.equal(data.campaignContext?.groupName, "Food Group");
  assert.equal(data.campaignContext?.agencyName, "Media Agency Egypt");
});

test("media plan includes campaign cost with VAT exclusion disclaimer", () => {
  const obj = buildCampaignObjectFixture({
    facts: { budget: { amount: 2_500_000, currency: "EGP" } },
  });
  const content = generateMediaPlan(obj);
  const data = planData(content);

  assert.deepEqual(data.campaignContext?.campaignCost, { amount: 2_500_000, currency: "EGP" });

  const costSection = content.sections.find((section) => section.heading === "Campaign Cost");
  assert.ok(costSection?.items?.some((item) => item.includes("2,500,000 EGP")));
  assert.ok(costSection?.items?.some((item) => item.includes("Price excludes VAT")));
});

test("campaign cost falls back to summed quoted creator revenue", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { budget: undefined },
      creators: [
        { id: "cr_a", name: "Creator A", tier: "Macro" },
        { id: "cr_b", name: "Creator B", tier: "Macro" },
      ],
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    entry.quotedRevenue = 50_000;
    entry.quotedCurrency = "EGP";
  }

  const data = planData(generateMediaPlan(obj));
  assert.deepEqual(data.campaignContext?.campaignCost, { amount: 100_000, currency: "EGP" });
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

test("deadlines consolidate multiple deliverables into one row per creator", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 2 },
      creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel", "1× IG Set of stories", "1× Mirrored IG"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
  }

  const data = planData(generateMediaPlan(obj));
  const nourDeadlines = data.deadlines.filter((deadline) => deadline.creator === "Nour Star");

  assert.equal(nourDeadlines.length, 1);
  assert.deepEqual(nourDeadlines[0]!.serviceTypes, [
    "1× IG Reel",
    "1× IG Set of stories",
    "1× Mirrored IG",
  ]);
});

test("quotation deadlines use one row per scheduled creator", () => {
  const creators = Array.from({ length: 32 }, (_, index) => ({
    id: `cr_${index + 1}`,
    name: `Creator ${index + 1}`,
    tier: "Macro",
  }));
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 4 },
      creators,
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    entry.serviceTypes = ["1× IG Reel", "1× Mirrored IG", "1× TT Video"];
    entry.serviceLabel = entry.serviceTypes.join(" · ");
  }

  const data = planData(generateMediaPlan(obj));
  assert.equal(data.deadlines.length, 32);
  assert.ok(data.deadlines.every((deadline) => (deadline.serviceTypes?.length ?? 0) === 3));
});

test("deadlines carry creator ids for avatar enrichment", () => {
  const data = planData(generateMediaPlan(buildCampaignObjectFixture()));
  assert.ok(data.deadlines.length >= 1);
  assert.ok(data.deadlines.every((d) => d.creatorId && d.shortName));
});
