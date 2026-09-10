import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import {
  proposeInitialCreatorSlateWithStatus,
} from "./propose-creator-slate";

const NOW = new Date().toISOString();

function baseObject(creatorsData: CreatorsSectionData = {}): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      creators: { status: "complete", content: "", data: creatorsData },
      strategy: { status: "complete", content: "TikTok summer campaign" },
      summary: { status: "complete", content: "Brand summer push" },
      timeline: { status: "complete", content: "", data: {} },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        clientName: "e&",
        brandName: "e&",
        objective: "Reach Gen Z",
        budget: { amount: 1_000_000, currency: "EGP" },
        durationWeeks: 6,
        platforms: ["TikTok"],
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

test("propose blocks with explicit message when no discovery pool exists", () => {
  const result = proposeInitialCreatorSlateWithStatus(baseObject());
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.equal(result.proposed, false);
  assert.equal(data.slateProposalStatus?.status, "blocked");
  assert.match(data.slateProposalStatus?.message ?? "", /Vendor Discovery/i);
});

test("propose uses strategy vendor metadata when searchResults unavailable", () => {
  const result = proposeInitialCreatorSlateWithStatus(
    baseObject({
      recommendations: {
        creatorIds: [],
        selectedReasoning: [
          {
            creatorId: "inf:strategy-1",
            displayName: "Salma",
            expectedRole: "Macro",
            whySelected: "Director pick",
            audienceMatch: "",
            risk: "",
            alternative: "",
            confidence: 0.8,
            evidence: "",
            tradeoff: "",
          },
        ],
      },
    })
  );
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.equal(result.proposed, true);
  assert.ok((data.recommendations?.creatorIds.length ?? 0) > 0);
  assert.equal(data.phase, "proposal");
});

test("propose prefers workflow searchResults pool over strategy fallback", () => {
  const result = proposeInitialCreatorSlateWithStatus(
    baseObject({
      recommendations: {
        creatorIds: [],
        selectedReasoning: [
          {
            creatorId: "inf:strategy-1",
            displayName: "Strategy Vendor",
            expectedRole: "Macro",
            whySelected: "",
            audienceMatch: "",
            risk: "",
            alternative: "",
            confidence: 0.8,
            evidence: "",
            tradeoff: "",
          },
        ],
      },
    }),
    {
      poolCreators: [
        {
          id: "inf:discovery-1",
          handle: "@discovery",
          displayName: "Discovery Vendor",
          platform: "tiktok",
          campaignRelevanceScore: 90,
        },
      ],
    }
  );
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.ok(data.recommendations?.creatorIds.includes("inf:discovery-1"));
});

test("re-run failure retains committed creatorIds", () => {
  const existingIds = ["inf:existing-1", "inf:existing-2"];
  const result = proposeInitialCreatorSlateWithStatus(
    baseObject({
      phase: "discovery",
      recommendations: {
        creatorIds: existingIds,
      },
      vendorDecisions: { "inf:existing-1": "approved" },
    }),
    { poolCreators: [] }
  );
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.equal(result.proposed, false);
  assert.deepEqual(data.recommendations?.creatorIds, existingIds);
  assert.equal(data.vendorDecisions?.["inf:existing-1"], "approved");
  assert.equal(data.pendingProposal?.status, "failed");
  assert.equal(data.slateProposalStatus?.status, "blocked");
});

test("re-run success replaces committed creatorIds", () => {
  const result = proposeInitialCreatorSlateWithStatus(
    baseObject({
      phase: "discovery",
      recommendations: {
        creatorIds: ["inf:old-1"],
        selectedReasoning: [
          {
            creatorId: "inf:old-1",
            displayName: "Old Creator",
            expectedRole: "Macro",
            whySelected: "",
            audienceMatch: "",
            risk: "",
            alternative: "",
            confidence: 0.8,
            evidence: "",
            tradeoff: "",
          },
        ],
      },
      vendorDecisions: { "inf:old-1": "approved" },
    }),
    {
      poolCreators: [
        {
          id: "inf:new-1",
          handle: "@new",
          displayName: "New Creator",
          platform: "tiktok",
          campaignRelevanceScore: 95,
        },
      ],
    }
  );
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.equal(result.proposed, true);
  assert.ok(data.recommendations?.creatorIds.includes("inf:new-1"));
  assert.equal(data.recommendations?.creatorIds.includes("inf:old-1"), false);
  assert.equal(data.vendorDecisions, undefined);
  assert.equal(data.pendingProposal, undefined);
  assert.equal(data.phase, "proposal");
});

test("first-run failure does not create pendingProposal", () => {
  const result = proposeInitialCreatorSlateWithStatus(baseObject({ phase: "discovery" }));
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.equal(result.proposed, false);
  assert.equal(data.recommendations?.creatorIds?.length ?? 0, 0);
  assert.equal(data.pendingProposal, undefined);
  assert.equal(data.slateProposalStatus?.status, "blocked");
});

test("campaign analysis is computed on the first proposal, not only after an edit", () => {
  const result = proposeInitialCreatorSlateWithStatus(
    baseObject({
      recommendations: {
        creatorIds: [],
        selectedReasoning: [
          {
            creatorId: "inf:strategy-1",
            displayName: "Salma",
            expectedRole: "Macro",
            whySelected: "Director pick",
            audienceMatch: "",
            risk: "",
            alternative: "",
            confidence: 0.8,
            evidence: "",
            tradeoff: "",
          },
        ],
      },
    })
  );

  assert.equal(result.proposed, true);
  const performance = (result.campaignObject.sections.performance?.data ??
    {}) as Record<string, unknown>;
  assert.ok(performance.campaignForecast, "the forecast must exist before any operator edit");
  assert.ok(performance.campaignScores, "campaign health must exist before any operator edit");

  const scores = performance.campaignScores as { overall: number; basis: string[] };
  assert.ok(Number.isFinite(scores.overall));
  assert.ok(scores.basis.length > 0, "every health dimension carries its explanation");

  // Slate composition is exposed so requested vs achieved mix is visible.
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.ok(data.slateComposition, "slate composition must be persisted");
  assert.equal(
    data.slateComposition!.achievedCount,
    data.recommendations?.creatorIds.length
  );
});

test("campaign analysis needs neither a budget nor creator pricing", () => {
  const object = baseObject({
    recommendations: {
      creatorIds: [],
      selectedReasoning: [
        {
          creatorId: "inf:strategy-1",
          displayName: "Salma",
          expectedRole: "Macro",
          whySelected: "Director pick",
          audienceMatch: "",
          risk: "",
          alternative: "",
          confidence: 0.8,
          evidence: "",
          tradeoff: "",
        },
      ],
    },
  });
  const facts = (object.meta as Record<string, unknown>).campaignFacts as Record<string, unknown>;
  delete facts.budget;

  const result = proposeInitialCreatorSlateWithStatus(object);
  const performance = (result.campaignObject.sections.performance?.data ??
    {}) as Record<string, unknown>;

  assert.equal(result.proposed, true);
  assert.ok(performance.campaignForecast, "a budget-less campaign still gets a forecast");
  assert.ok(performance.campaignScores, "a budget-less campaign still gets health scores");
});
