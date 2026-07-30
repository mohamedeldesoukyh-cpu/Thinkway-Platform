import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  isAssignmentBackedMatch,
  operationalMatchKey,
} from "./operational-refs";
import { performanceFactsFromAssignmentHierarchy } from "./performance-facts";
import {
  projectActualMediaPlan,
  projectRemainingMediaPlan,
} from "./projections";
import { assertScheduleMoveAllowedByAssignmentGrain } from "./grain-lock-guards";
import type { MediaPlanItem, MediaPlanPerformanceFact, MediaPlanState } from "./types";
import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

test("operationalMatchKey prefers post → deliverable → assignment → legacy", () => {
  assert.equal(
    operationalMatchKey({
      assignmentPostScheduleId: "post-1",
      assignmentDeliverableId: "d1",
      campaignLineId: "line-1",
      creatorId: "inf",
      platform: "IG",
      deliverable: "Reel",
    }).mode,
    "assignment_post"
  );
  assert.equal(
    operationalMatchKey({
      assignmentDeliverableId: "d1",
      campaignLineId: "line-1",
      creatorId: "inf",
      platform: "IG",
      deliverable: "Reel",
    }).mode,
    "assignment_deliverable"
  );
  assert.equal(
    operationalMatchKey({
      campaignLineId: "line-1",
      creatorId: "inf",
      platform: "IG",
      deliverable: "Reel",
    }).mode,
    "assignment"
  );
  const legacy = operationalMatchKey({
    creatorId: "inf",
    platform: "IG",
    deliverable: "Reel",
  });
  assert.equal(legacy.mode, "legacy_label");
  assert.equal(isAssignmentBackedMatch(legacy.mode), false);
});

test("performanceFactsFromAssignmentHierarchy emits Assignment IDs", () => {
  const hierarchy = {
    groups: [
      {
        line: {
          id: "line-1",
          influencer_id: "inf-1",
          influencer_name: "Layla",
        },
        deliverables: [
          {
            id: "d1",
            label: "IG Reel",
            platform: "instagram",
            deliverable_type_label: "IG Reel",
            live_date: "2026-08-01",
            is_locked: false,
            billing_status: "open",
            posts: [
              {
                id: "p1",
                platform: "instagram",
                deliverable_type_label: "IG Reel",
                live_date: "2026-08-01",
                is_locked: false,
                billing_status: "open",
              },
            ],
          },
        ],
      },
    ],
  } as unknown as AssignmentHierarchy;

  const facts = performanceFactsFromAssignmentHierarchy(hierarchy);
  assert.equal(facts.length, 1);
  assert.equal(facts[0]!.campaignLineId, "line-1");
  assert.equal(facts[0]!.assignmentDeliverableId, "d1");
  assert.equal(facts[0]!.assignmentPostScheduleId, "p1");
  assert.equal(facts[0]!.completed, true);
});

function sampleState(items: MediaPlanItem[]): MediaPlanState {
  return {
    mediaPlanId: "mp",
    campaignId: "camp",
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
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ],
  };
}

test("projectActualMediaPlan matches by Assignment ID not creator label alone", () => {
  const planned: MediaPlanItem[] = [
    {
      id: "i1",
      creatorId: "inf-a",
      creatorName: "A",
      platform: "Instagram",
      deliverable: "IG Reel",
      plannedDate: "2026-08-10",
      actualLiveDate: null,
      status: "planned",
      campaignLineId: "line-1",
      assignmentPostScheduleId: "p1",
    },
    {
      id: "i2",
      creatorId: "inf-a",
      creatorName: "A",
      platform: "Instagram",
      deliverable: "IG Reel",
      plannedDate: "2026-08-11",
      actualLiveDate: null,
      status: "planned",
      campaignLineId: "line-2",
      assignmentPostScheduleId: "p2",
    },
  ];

  const facts: MediaPlanPerformanceFact[] = [
    {
      creatorId: "inf-a",
      creatorName: "A",
      platform: "Instagram",
      deliverable: "IG Reel",
      liveDate: "2026-08-10",
      completed: true,
      campaignLineId: "line-1",
      assignmentPostScheduleId: "p1",
    },
  ];

  const actual = projectActualMediaPlan(sampleState(planned), facts);
  assert.equal(actual.items.length, 1);
  assert.equal(actual.items[0]!.campaignLineId, "line-1");
  assert.equal(actual.items[0]!.usedLegacyMatch, false);

  const remaining = projectRemainingMediaPlan(sampleState(planned), facts);
  assert.equal(remaining.items.length, 1);
  assert.equal(remaining.items[0]!.campaignLineId, "line-2");
});

test("grain lock guard blocks live and billing-locked grains", () => {
  const facts: MediaPlanPerformanceFact[] = [
    {
      creatorId: "inf-1",
      platform: "IG",
      deliverable: "Reel",
      liveDate: "2026-08-01",
      completed: true,
      campaignLineId: "line-1",
      billingLocked: true,
    },
  ];
  const blocked = assertScheduleMoveAllowedByAssignmentGrain(facts, {
    campaignLineIds: ["line-1"],
  });
  assert.equal(blocked.ok, false);

  const allowed = assertScheduleMoveAllowedByAssignmentGrain(
    [
      {
        creatorId: "inf-2",
        platform: "IG",
        deliverable: "Reel",
        liveDate: null,
        completed: false,
        campaignLineId: "line-2",
      },
    ],
    { campaignLineIds: ["line-2"] }
  );
  assert.equal(allowed.ok, true);
});
