import assert from "node:assert/strict";

import type { CampaignObject } from "@/features/campaign-intelligence";

import {
  buildTentativeScheduleLabel,
  extractTentativeScheduleFromCampaignPlan,
  normalizeCreatorScheduleKey,
  resolveCampaignPlanAnchorStartDate,
  resolveTentativePostingDate,
} from "./campaign-plan-tentative-schedule";

function baseCampaignObject(overrides?: Partial<CampaignObject>): CampaignObject {
  return {
    id: "co-test",
    workflowId: null,
    sections: {
      summary: { content: { campaignName: "Summer Launch" }, status: "complete" },
      audience: { content: "", status: "pending" },
      strategy: { content: "", status: "pending" },
      creators: {
        content: "",
        data: {
          recommendations: {
            creatorIds: ["inf:alpha", "inf:beta"],
            selectedReasoning: [
              {
                creatorId: "inf:alpha",
                displayName: "Alpha Creator",
                whySelected: "",
                expectedRole: "macro",
                audienceMatch: "",
                risk: "",
                alternative: "",
              },
              {
                creatorId: "inf:beta",
                displayName: "Beta Creator",
                whySelected: "",
                expectedRole: "micro",
                audienceMatch: "",
                risk: "",
                alternative: "",
              },
            ],
          },
        },
        status: "complete",
      },
      budget: { content: "", status: "pending" },
      timeline: {
        content: {
          durationWeeks: 4,
          milestones: [],
          goLiveWeek: 1,
        },
        status: "complete",
      },
      performance: { content: "", status: "pending" },
      presentation: { content: "", status: "pending" },
      operations: { content: "", status: "pending" },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        durationWeeks: 4,
        platforms: ["Instagram", "TikTok"],
        deliverables: ["Instagram Reel"],
        extractedAt: new Date().toISOString(),
        confidence: {},
        sources: {},
      },
    },
    ...overrides,
  } as CampaignObject;
}

assert.equal(buildTentativeScheduleLabel(2, "Tuesday"), "Week 2 · Tuesday");

assert.equal(
  resolveTentativePostingDate("2026-07-06", 1, "Monday"),
  "2026-07-06"
);
assert.equal(
  resolveTentativePostingDate("2026-07-06", 2, "Tuesday"),
  "2026-07-14"
);
assert.equal(resolveTentativePostingDate(null, 1, "Monday"), null);

const anchor = resolveCampaignPlanAnchorStartDate({
  campaignObject: baseCampaignObject(),
  issueDate: "2026-08-01",
});
assert.equal(anchor, "2026-08-01");

const schedule = extractTentativeScheduleFromCampaignPlan(baseCampaignObject(), {
  anchorStartDate: "2026-07-06",
  issueDate: "2026-08-01",
});

assert.ok(schedule.size > 0, "schedule map should not be empty");

const alphaById = schedule.get(normalizeCreatorScheduleKey("inf:alpha"));
const alphaByName = schedule.get(normalizeCreatorScheduleKey("Alpha Creator"));
assert.ok(alphaById, "alpha schedule by unified id");
assert.deepEqual(alphaByName, alphaById, "display name resolves to same bundle");

assert.ok(alphaById!.primary.tentative_posting_label?.startsWith("Week "));
assert.equal(alphaById!.primary.schedule_source, "campaign_plan");
assert.ok(alphaById!.primary.planned_week != null);
assert.ok(alphaById!.primary.tentative_posting_date, "calendar date when anchor provided");

const instagramSchedule = alphaById!.byPlatform.instagram;
if (instagramSchedule) {
  assert.equal(instagramSchedule.schedule_source, "campaign_plan");
}

console.log("campaign-plan-tentative-schedule.test.ts: all assertions passed");
