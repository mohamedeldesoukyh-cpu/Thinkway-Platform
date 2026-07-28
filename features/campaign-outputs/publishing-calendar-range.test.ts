/**
 * Publishing Calendar — Saturday–Friday calendar weeks from campaign date range.
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";

import { asMediaPlanData, generateMediaPlan } from "./generators/media-plan";
import { resolvePublishingCalendarRange } from "./media-plan-week-start";

function campaignWithDates(startIso: string, endIso: string, durationWeeks: number): CampaignObject {
  return {
    id: "co-cal",
    conversationId: "conv-cal",
    workflowId: "create-campaign",
    updatedAt: new Date().toISOString(),
    sections: {
      summary: { status: "complete", content: "", data: {} },
      creators: {
        status: "complete",
        content: "",
        data: {
          recommendations: {
            creatorIds: ["c1"],
            selectedReasoning: [
              {
                creatorId: "c1",
                displayName: "Creator One",
                tier: "Macro",
                platform: "Instagram",
              },
            ],
          },
        },
      },
      budget: { status: "complete", content: "", data: {} },
      timeline: { status: "complete", content: "", data: {} },
      performance: { status: "complete", content: "", data: {} },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        brandName: "Acme",
        durationWeeks,
        campaignStartDate: startIso,
        requestedStartDate: startIso,
        campaignEndDate: endIso,
        platforms: ["Instagram"],
      },
    },
  } as unknown as CampaignObject;
}

test("generator: 15 Jul – 14 Aug 2026 renders five Sat–Fri weeks", () => {
  const range = resolvePublishingCalendarRange("2026-07-15", "2026-08-14");
  assert.equal(range?.weeks.length, 5);

  const content = generateMediaPlan(
    campaignWithDates("2026-07-15", "2026-08-14", 4)
  );
  const data = asMediaPlanData(content.data);
  assert.ok(data);
  assert.equal(data!.weeks.length, 5);
  assert.equal(data!.calendarWeeks, 5);
  assert.equal(data!.scheduledStartDate, "2026-07-11");
  assert.equal(data!.requestedStartDate, "2026-07-15");
  assert.equal(data!.campaignEndDate, "2026-08-14");
  assert.equal(data!.weeks[0]!.days[0]!.day, "Saturday");
  assert.equal(data!.weeks[0]!.days[6]!.day, "Friday");
  assert.equal(data!.weeks[0]!.days[0]!.dateLabel, "11/7/26");
  assert.equal(data!.weeks[0]!.days[6]!.dateLabel, "17/7/26");
  assert.equal(data!.weeks[4]!.days[0]!.dateLabel, "8/8/26");
  assert.equal(data!.weeks[4]!.days[6]!.dateLabel, "14/8/26");
});
