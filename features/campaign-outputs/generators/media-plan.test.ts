import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { generateMediaPlan, enrichMediaPlanFromSlate, enrichMediaPlanCampaignContext, wantsPaidAmplification, resolveCalendarWeekCount, type MediaPlanData } from "./media-plan";
import { resolveSlate } from "../output-inputs";
import { buildCampaignObjectFixture } from "../output-test-fixture";
import { hydrateCampaignObject } from "../hydration/hydrate";
import { seedFromQuotation } from "../hydration/seed-adapters";

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

test("quotation calendar groups mirrors onto primary activation days", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 4 },
      creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel", "1× IG Set of stories", "1× Mirrored IG"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
  }
  obj.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const data = planData(generateMediaPlan(obj));
  const nourDays = data.weeks
    .flatMap((w) => w.days)
    .filter((d) => d.creator === "Nour Star");

  assert.equal(nourDays.length, 1, "IG Reel + Stories + Mirror = 1 strategic activation day");
  assert.ok(nourDays.some((day) => day.additionalDeliverables?.some((entry) => entry.isMirror)));
  assert.ok(
    nourDays.some((day) => day.additionalDeliverables?.some((entry) => entry.isCompanion)),
    "IG Story Set should bundle as companion on the Reel day"
  );
  assert.equal(data.postingSlotCount, 1);
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
      const additional =
        day.additionalDeliverables?.filter((entry) => !entry.isMirror).length ?? 0;
      return total + primary + additional;
    }, 0);

  assert.equal(data.durationWeeks, 4);
  assert.equal(data.weeks.length, 4);
  assert.equal(data.postingSlotCount, 32);
  assert.equal(scheduledDeliverables, 32);
  assert.equal(data.unscheduledDeliverableCount, undefined);
});

test("many quoted lines collapse mirrors into activations across the calendar", () => {
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
  const scheduledDeliverables = data.weeks
    .flatMap((week) => week.days)
    .reduce((total, day) => {
      const primary = day.creator ? 1 : 0;
      const additional =
        day.additionalDeliverables?.filter((entry) => !entry.isMirror).length ?? 0;
      return total + primary + additional;
    }, 0);

  assert.equal(data.weeks.length, 4);
  assert.equal(data.postingSlotCount, 64);
  assert.equal(scheduledDeliverables, 64);
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
  assert.equal(data.postingSlotCount, 1);
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
  assert.ok(data.waves.length >= 1);
  assert.ok(!data.milestones.some((m) => m.label.includes("content review & approvals")));
  assert.ok(data.milestones.some((m) => m.type === "client_approval"));
  assert.ok(data.milestones.some((m) => m.type === "review"));
  assert.ok(data.dependencies.length >= 1);
  assert.ok(data.deadlines.length >= 1);
  assert.ok(data.deadlines.every((d) => d.productionStart && d.assetDelivery));
  assert.ok(!data.deadlines.some((d) => d.productionStart.startsWith("Week ")));
  assert.ok(Object.keys(data.platformAllocation).length >= 1);
});

test("strategy mode activates when campaign brief is present", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: {
        durationWeeks: 4,
        rawBriefExcerpt:
          "Four-week summer launch — front-load Week 1 with hero creators and sustain through weeks 2–4.",
        platforms: ["TikTok", "Instagram"],
      },
      creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
    })
  );

  const data = planData(generateMediaPlan(obj));
  assert.equal(data.planMode, "strategy");
  assert.ok(data.waves.length >= 1);
  assert.ok(data.strategySummary?.narrative?.platformIntelligence);
  assert.ok(data.strategySummary?.executiveSummary);
});

test("planning mode omits strategy waves and uses quotation overview", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: {
        durationWeeks: 4,
        objective: "",
        platforms: ["Instagram"],
      },
      strategyContent: "",
      creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel", "1× FB Post", "1× YT Video"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
    reasoning[0].platform = "Instagram";
  }

  const data = planData(generateMediaPlan(obj));
  assert.equal(data.planMode, "planning");
  assert.equal(data.waves.length, 0);
  assert.ok(data.strategySummary?.campaignOverview);
  assert.ok(data.platformAllocation.Facebook);
  assert.ok(data.platformAllocation.YouTube);
  assert.ok(data.platformAllocation.Instagram);
});

test("calendar-driven activation waves include activation counts", () => {
  const obj = withQuotationCreators(buildCampaignObjectFixture({ facts: { durationWeeks: 4 } }));
  const data = planData(generateMediaPlan(obj));
  assert.ok(data.waves.length >= 1);
  assert.ok(data.waves.every((wave) => /activation/i.test(wave.theme)));
  assert.ok(!data.waves.some((wave) => wave.theme === "Hero launch & awareness"));
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

test("media plan dual-stores requested Friday and Saturday publishing Week 1", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 2, campaignStartDate: "2026-07-24" },
  });
  const data = planData(generateMediaPlan(obj));
  assert.equal(data.requestedStartDate, "2026-07-24");
  assert.equal(data.scheduledStartDate, "2026-07-18");
  assert.equal(data.campaignStartDate, "2026-07-18");
  assert.equal(data.weeks[0]!.days[0]!.day, "Saturday");
  assert.equal(data.weeks[0]!.days[0]!.dateLabel, "18/7/26");
  assert.equal(data.weeks[0]!.days[6]!.dateLabel, "24/7/26");
});

test("generate never places creators before Campaign Start (hard window)", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 2, campaignStartDate: "2026-07-24" },
  });
  const data = planData(generateMediaPlan(obj));
  // Sat–Thu (18–23 Jul) are grid days before business start — must stay empty of creators.
  for (let dayIndex = 0; dayIndex < 6; dayIndex += 1) {
    const day = data.weeks[0]!.days[dayIndex]!;
    assert.equal(
      day.creatorId,
      undefined,
      `dayIndex ${dayIndex} (${day.dateLabel}) must not hold a creator before campaign start`
    );
    assert.equal(day.additionalDeliverables?.length ?? 0, 0);
  }
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

test("media plan includes campaign cost with VAT and usage-rights disclaimers", () => {
  const obj = buildCampaignObjectFixture({
    facts: { budget: { amount: 2_500_000, currency: "EGP" } },
  });
  const content = generateMediaPlan(obj);
  const data = planData(content);

  assert.deepEqual(data.campaignContext?.campaignCost, { amount: 2_500_000, currency: "EGP" });

  const costSection = content.sections.find((section) => section.heading === "Campaign Cost");
  assert.ok(costSection?.items?.some((item) => item.includes("2,500,000 EGP")));
  assert.ok(costSection?.items?.some((item) => item.includes("Price excludes VAT")));
  assert.ok(
    costSection?.items?.some((item) =>
      item.includes("Usage rights are not included in quoted prices and are granted upon request")
    )
  );
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

test("deadlines consolidate only when multiple deliverables share the same publish day", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 2 },
      creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel"];
    reasoning[0].serviceLabel = "1× IG Reel";
  }

  const data = planData(generateMediaPlan(obj));
  const nourDeadlines = data.deadlines.filter((deadline) => deadline.creator === "Nour Star");

  assert.equal(nourDeadlines.length, 1);
  // Deadlines are rebuilt from calendar cells, which use activation display labels.
  assert.ok(
    nourDeadlines[0]!.serviceTypes?.some((type) => /IG Reel/i.test(type)),
    `expected IG Reel deliverable, got ${JSON.stringify(nourDeadlines[0]!.serviceTypes)}`
  );
});

test("quotation deadlines use one row per activation publish slot", () => {
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
  assert.equal(data.deadlines.length, 64);
  assert.ok(
    data.deadlines.some(
      (deadline) => (deadline.serviceTypes?.length ?? 0) > 1 && deadline.serviceTypes?.some((type) => /Mirror/i.test(type))
    )
  );
});

test("manual quotation lines each become separate seed creators", () => {
  const quotation = {
    id: "q1",
    name: "TBH plan",
    currency: "EGP",
    total_revenue_egp: 50_000,
    items: [
      {
        id: "manual-1",
        creator_name: "Instagram TBH",
        platform: "instagram",
        revenue_egp: 10_000,
        deliverables: [{ platform: "instagram", type_lines: [{ type: "ig_reel", quantity: 1 }] }],
      },
      {
        id: "manual-2",
        creator_name: "UGC TBH",
        platform: "instagram",
        revenue_egp: 10_000,
        deliverables: [{ platform: "instagram", type_lines: [{ type: "ig_post", quantity: 1 }] }],
      },
      {
        id: "manual-3",
        creator_name: "TikTok TBH",
        platform: "tiktok",
        revenue_egp: 10_000,
        deliverables: [{ platform: "tiktok", type_lines: [{ type: "tiktok_video", quantity: 1 }] }],
      },
    ],
  } as unknown as import("@/lib/domains/commercial/quotation-detail-types").QuotationDetail;

  const seed = seedFromQuotation(quotation);
  assert.equal(seed.creators.length, 3);
  assert.ok(seed.creators.every((creator) => creator.creatorId.startsWith("manual:")));

  const { campaignObject } = hydrateCampaignObject(seed);
  const slate = resolveSlate(campaignObject);
  assert.equal(slate.length, 3);

  const data = generateMediaPlan(campaignObject).data as MediaPlanData;
  assert.equal(data.creatorCount, 3);
  const scheduledNames = new Set(
    data.weeks.flatMap((week) =>
      week.days.flatMap((day) => [
        ...(day.creator ? [day.creator] : []),
        ...(day.additionalDeliverables?.map((entry) => entry.creator) ?? []),
      ])
    )
  );
  assert.ok(scheduledNames.has("Instagram TBH"));
  assert.ok(scheduledNames.has("UGC TBH"));
  assert.ok(scheduledNames.has("TikTok TBH"));
});

test("quotation calendar leaves unscheduled days blank — no open publishing slot filler", () => {
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 4 },
      creators: Array.from({ length: 5 }, (_, index) => ({
        id: `cr_${index + 1}`,
        name: `Creator ${index + 1}`,
        tier: "Macro",
      })),
    })
  );
  const data = planData(generateMediaPlan(obj));
  const openSlots = data.weeks
    .flatMap((week) => week.days)
    .filter((day) => day.label === "Open publishing slot" || day.label === "Creator publishing slot");
  assert.equal(openSlots.length, 0);

  const blankDays = data.weeks
    .flatMap((week) => week.days)
    .filter((day) => !day.creator && !(day.additionalDeliverables?.length));
  assert.ok(blankDays.length > 0, "calendar should include intentional blank days");
  for (const day of blankDays) {
    assert.equal(day.label, "");
  }
});

test("week weights concentrate deliverables in early weeks", () => {
  const creators = Array.from({ length: 8 }, (_, index) => ({
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
  obj.meta.mediaPlanSchedule = { weekWeights: [40, 40, 10, 10] };
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    entry.serviceTypes = ["1× IG Reel"];
    entry.serviceLabel = "1× IG Reel";
    entry.quotedRevenue = 5_000;
    entry.quotedCurrency = "EGP";
  }

  const data = planData(generateMediaPlan(obj));
  const weekCounts = data.weeks.map(
    (week) =>
      week.days.filter((day) => day.creator || (day.additionalDeliverables?.length ?? 0) > 0).length
  );
  assert.ok((weekCounts[0] ?? 0) + (weekCounts[1] ?? 0) >= (weekCounts[2] ?? 0) + (weekCounts[3] ?? 0));
});

test("launch brief auto front-loads quotation calendar without explicit weekWeights meta", () => {
  const creators = Array.from({ length: 8 }, (_, index) => ({
    id: `cr_${index + 1}`,
    name: `Creator ${index + 1}`,
    tier: "Macro",
  }));
  const obj = withQuotationCreators(
    buildCampaignObjectFixture({
      facts: {
        durationWeeks: 4,
        rawBriefExcerpt:
          "Summer launch — front-load Week 1 go-live with hero creators, sustain through weeks 2-4 for BabyJoy in Egypt.",
      },
      creators,
    })
  );
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  for (const entry of creatorsData.recommendations?.selectedReasoning ?? []) {
    entry.serviceTypes = ["1× IG Reel"];
    entry.serviceLabel = "1× IG Reel";
    entry.quotedRevenue = 5_000;
    entry.quotedCurrency = "EGP";
  }

  const data = planData(generateMediaPlan(obj));
  const weekCounts = data.weeks.map(
    (week) =>
      week.days.filter((day) => day.creator || (day.additionalDeliverables?.length ?? 0) > 0).length
  );
  assert.ok((weekCounts[0] ?? 0) >= (weekCounts[3] ?? 0));
});

