import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

import {
  applyAudienceChange,
  applyBudgetChange,
  applyPlatformsChange,
  applyTimelineChange,
  patchCampaignFacts,
} from "./campaign-facts-mutations";

const NOW = new Date().toISOString();

function campaignObject(): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      summary: { status: "complete", content: "", data: { summaryCards: { client: "e&" } } },
      creators: { status: "complete", content: "", data: {} },
      budget: { status: "complete", content: "", data: {} },
      timeline: { status: "complete", content: "", data: {} },
      performance: { status: "complete", content: "", data: {} },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        clientName: "e&",
        brandName: "e&",
        objective: "Activate the song",
        budget: { amount: 1_000_000, currency: "EGP" },
        durationWeeks: 6,
        platforms: ["TikTok", "Instagram"],
        geography: ["Egypt"],
        audience: "Gen Z",
        deliverables: [],
        kpis: [],
        extractedAt: NOW,
        confidence: {},
        sources: {},
      },
    },
  } as unknown as CampaignObject;
}

test("budget change updates facts and refreshes the summary card", () => {
  const { campaignObject: next, change } = applyBudgetChange(campaignObject(), { amount: 2_000_000 });
  assert.match(change ?? "", /2,000,000 EGP/);
  assert.equal(getCampaignFacts(next)?.budget?.amount, 2_000_000);
  const cards = (next.sections.summary.data as { summaryCards: { budget?: string } }).summaryCards;
  assert.match(cards.budget ?? "", /2,000,000|2M|2 ?M/i);
});

test("budget change keeps existing currency unless overridden", () => {
  const { campaignObject: next } = applyBudgetChange(campaignObject(), {
    amount: 500_000,
    currency: "AED",
  });
  assert.equal(getCampaignFacts(next)?.budget?.currency, "AED");
});

test("invalid budget is a no-op", () => {
  const { change } = applyBudgetChange(campaignObject(), { amount: 0 });
  assert.equal(change, null);
});

test("timeline change clamps and updates duration weeks", () => {
  const { campaignObject: next, change } = applyTimelineChange(campaignObject(), {
    durationWeeks: 4,
  });
  assert.match(change ?? "", /4 weeks/);
  assert.equal(getCampaignFacts(next)?.durationWeeks, 4);

  const clamped = applyTimelineChange(campaignObject(), { durationWeeks: 999 });
  assert.equal(getCampaignFacts(clamped.campaignObject)?.durationWeeks, 52);
});

test("platforms change sets priority order with primary noted", () => {
  const { campaignObject: next, change } = applyPlatformsChange(campaignObject(), {
    platforms: ["TikTok", "Instagram"],
  });
  assert.match(change ?? "", /TikTok primary/);
  assert.deepEqual(getCampaignFacts(next)?.platforms, ["TikTok", "Instagram"]);
});

test("audience change updates the target audience", () => {
  const { campaignObject: next } = applyAudienceChange(campaignObject(), {
    audience: "Gen Z women in Egypt, skewing female",
  });
  assert.match(getCampaignFacts(next)?.audience ?? "", /female/);
  const cards = (next.sections.summary.data as { summaryCards: { targetAudience?: string } })
    .summaryCards;
  assert.match(cards.targetAudience ?? "", /female/);
});

test("patchCampaignFacts on an object without facts is a safe no-op", () => {
  const obj = campaignObject();
  delete obj.meta.campaignFacts;
  const next = patchCampaignFacts(obj, { durationWeeks: 3 });
  assert.equal(next, obj);
});
