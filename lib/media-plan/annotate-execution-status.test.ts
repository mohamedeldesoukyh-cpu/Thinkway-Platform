import assert from "node:assert/strict";
import test from "node:test";

import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";

import { annotateMediaPlanExecutionStatus } from "./annotate-execution-status";
import type { MediaPlanPerformanceFact } from "./types";

function planWithCreator(types: string[]): MediaPlanData {
  return {
    durationWeeks: 1,
    calendarWeeks: 1,
    campaignStartDate: "2026-08-01",
    scheduledStartDate: "2026-08-01",
    weeks: [
      {
        week: 1,
        wave: 1,
        phase: "Launch",
        days: [
          {
            day: "Saturday",
            dateLabel: "1/8/26",
            type: "content",
            label: "Coach A",
            creatorId: "inf-1",
            creator: "Coach A",
            serviceType: types[0],
            serviceTypes: types,
            platform: "Instagram",
          },
          ...Array.from({ length: 6 }, (_, i) => ({
            day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"][i]!,
            dateLabel: `${2 + i}/8/26`,
            type: "content" as const,
            label: "",
          })),
        ],
      },
    ],
    waves: [],
    milestones: [],
    platformAllocation: {},
    dependencies: [],
    deadlines: [],
    creatorCount: 1,
    serviceTypes: types,
    generatorVersion: "test",
  };
}

test("annotateMediaPlanExecutionStatus marks published when live_date fact matches creator", () => {
  const facts: MediaPlanPerformanceFact[] = [
    {
      creatorId: "inf-1",
      creatorName: "Coach A",
      platform: "Instagram",
      deliverable: "1× IG Reel",
      liveDate: "2026-08-02",
      completed: true,
    },
  ];
  const annotated = annotateMediaPlanExecutionStatus(
    planWithCreator(["1× IG Reel"]),
    facts
  );
  assert.equal(annotated.weeks[0]!.days[0]!.executionStatus, "published");
  assert.equal(annotated.weeks[0]!.days[0]!.actualLiveDate, "2026-08-02");
});

test("annotateMediaPlanExecutionStatus marks partial when only some types are live", () => {
  const facts: MediaPlanPerformanceFact[] = [
    {
      creatorId: "inf-1",
      creatorName: "Coach A",
      platform: "Instagram",
      deliverable: "1× IG Reel",
      liveDate: "2026-08-02",
      completed: true,
    },
  ];
  const annotated = annotateMediaPlanExecutionStatus(
    planWithCreator(["1× IG Reel", "1× TT Video"]),
    facts
  );
  assert.equal(annotated.weeks[0]!.days[0]!.executionStatus, "partial");
});

test("annotateMediaPlanExecutionStatus matches aggregate 2× labels to unit facts", () => {
  const facts: MediaPlanPerformanceFact[] = [
    {
      creatorId: "inf-1",
      creatorName: "Coach A",
      platform: "Instagram",
      deliverable: "2× IG Reel",
      liveDate: "2026-08-03",
      completed: true,
    },
  ];
  const annotated = annotateMediaPlanExecutionStatus(
    planWithCreator(["1× IG Reel"]),
    facts
  );
  assert.equal(annotated.weeks[0]!.days[0]!.executionStatus, "published");
});

test("annotateMediaPlanExecutionStatus leaves cards planned without live facts", () => {
  const annotated = annotateMediaPlanExecutionStatus(planWithCreator(["1× IG Reel"]), [
    {
      creatorId: "inf-1",
      creatorName: "Coach A",
      platform: "Instagram",
      deliverable: "1× IG Reel",
      liveDate: null,
      completed: false,
    },
  ]);
  assert.equal(annotated.weeks[0]!.days[0]!.executionStatus, "planned");
});
