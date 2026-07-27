import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";

import {
  emptyMediaPlanData,
  itemsToMediaPlanData,
  mediaPlanDataToItems,
} from "./calendar-adapter";
import { mediaPlanEngine } from "./media-plan-engine";
import type { MediaPlanItem, MediaPlanPerformanceFact, MediaPlanState } from "./types";

function sampleData(): MediaPlanData {
  return {
    durationWeeks: 2,
    campaignStartDate: "2026-08-10",
    weeks: [
      {
        week: 1,
        wave: 1,
        phase: "Launch",
        days: [
          {
            day: "Monday",
            type: "content",
            label: "IG Reel",
            creatorId: "ahmed",
            creator: "Ahmed",
            platform: "Instagram",
            serviceType: "IG Reel",
            serviceTypes: ["IG Reel", "IG Story"],
          },
          { day: "Tuesday", type: "content", label: "" },
          { day: "Wednesday", type: "content", label: "" },
          { day: "Thursday", type: "content", label: "" },
          { day: "Friday", type: "content", label: "" },
          { day: "Saturday", type: "content", label: "" },
          { day: "Sunday", type: "content", label: "" },
        ],
      },
      {
        week: 2,
        wave: 1,
        phase: "Sustain",
        days: [
          { day: "Monday", type: "content", label: "" },
          {
            day: "Tuesday",
            type: "content",
            label: "TikTok",
            creatorId: "sara",
            creator: "Sara",
            platform: "TikTok",
            serviceType: "TikTok",
            serviceTypes: ["TikTok"],
          },
          { day: "Wednesday", type: "content", label: "" },
          { day: "Thursday", type: "content", label: "" },
          { day: "Friday", type: "content", label: "" },
          { day: "Saturday", type: "content", label: "" },
          { day: "Sunday", type: "content", label: "" },
        ],
      },
    ],
    waves: [],
    milestones: [],
    platformAllocation: {},
    dependencies: [],
    deadlines: [],
    creatorCount: 2,
    serviceTypes: ["IG Reel", "IG Story", "TikTok"],
    generatorVersion: "test",
  };
}

test("mediaPlanDataToItems extracts planned slots", () => {
  const items = mediaPlanDataToItems(sampleData());
  assert.ok(items.length >= 3);
  assert.ok(items.some((item) => item.creatorId === "ahmed" && item.deliverable === "IG Reel"));
  assert.ok(items.some((item) => item.creatorId === "sara" && item.plannedDate === "2026-08-18"));
});

test("itemsToMediaPlanData round-trips onto MediaPlanCalendar weeks", () => {
  const items = mediaPlanDataToItems(sampleData());
  const data = itemsToMediaPlanData(items, {
    campaignStartDate: "2026-08-10",
    durationWeeks: 2,
    viewKind: "original",
  });
  assert.equal(data.weeks.length, 2);
  assert.ok(data.weeks[0]?.days[0]?.creatorId === "ahmed");
  assert.ok((data.weeks[0]?.days[0]?.serviceTypes?.length ?? 0) >= 1);
});

test("Actual projection feeds the same calendar adapter", () => {
  const items = mediaPlanDataToItems(sampleData());
  const state: MediaPlanState = {
    mediaPlanId: "mp",
    campaignId: "c1",
    campaignObjectId: "co",
    source: "campaign",
    currentApprovedBaselineVersion: 1,
    workingDraftVersion: null,
    versions: [
      {
        version: 1,
        kind: "baseline",
        status: "approved_by_client",
        items,
        createdAt: "2026-07-27T00:00:00.000Z",
      },
    ],
  };

  const performance: MediaPlanPerformanceFact[] = [
    {
      creatorId: "ahmed",
      platform: "Instagram",
      deliverable: "IG Reel",
      liveDate: "2026-08-10",
      completed: true,
    },
    {
      creatorId: "ahmed",
      platform: "Instagram",
      deliverable: "IG Story",
      liveDate: "2026-08-10",
      completed: true,
    },
  ];

  const actual = mediaPlanEngine.projectActual(state, performance);
  const calendar = itemsToMediaPlanData(actual.items, {
    campaignStartDate: "2026-08-10",
    viewKind: "actual",
    dateField: "actualLiveDate",
  });
  assert.equal(calendar.weeks[0]?.days[0]?.creatorId, "ahmed");
  assert.ok((calendar.weeks[0]?.days[0]?.serviceTypes?.length ?? 0) >= 2);
});

test("emptyMediaPlanData yields a renderable grid", () => {
  const empty = emptyMediaPlanData("2026-08-10", 4);
  assert.equal(empty.weeks.length, 4);
  assert.equal(empty.creatorCount, 0);
});

test("Remaining uses planned dates via adapter after Engine projection", () => {
  const items: MediaPlanItem[] = mediaPlanDataToItems(sampleData());
  const state: MediaPlanState = {
    mediaPlanId: "mp",
    campaignId: "c1",
    campaignObjectId: "co",
    source: "campaign",
    currentApprovedBaselineVersion: 1,
    workingDraftVersion: null,
    versions: [
      {
        version: 1,
        kind: "baseline",
        status: "approved_by_client",
        items,
        createdAt: "2026-07-27T00:00:00.000Z",
      },
    ],
  };
  const performance: MediaPlanPerformanceFact[] = [
    {
      creatorId: "ahmed",
      platform: "Instagram",
      deliverable: "IG Reel",
      liveDate: "2026-08-10",
      completed: true,
    },
  ];
  const remaining = mediaPlanEngine.projectRemaining(state, performance);
  assert.ok(remaining.items.every((item) => item.deliverable !== "IG Reel"));
  const calendar = itemsToMediaPlanData(remaining.items, {
    campaignStartDate: "2026-08-10",
    viewKind: "remaining",
    dateField: "plannedDate",
  });
  assert.ok(calendar.creatorCount >= 1);
});
