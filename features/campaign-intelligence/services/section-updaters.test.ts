import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import {
  applyTaskResultToCampaignObject,
  beginPendingCreatorProposal,
} from "./section-updaters";

const NOW = new Date().toISOString();

function baseCampaignObject(creatorsData: CreatorsSectionData = {}): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      creators: {
        status: "complete",
        content: "Discovery results",
        data: creatorsData,
      },
      summary: { status: "complete", content: "" },
      audience: { status: "complete", content: "" },
      strategy: { status: "complete", content: "" },
      budget: { status: "complete", content: "" },
      timeline: { status: "complete", content: "" },
      performance: { status: "complete", content: "" },
      presentation: { status: "complete", content: "" },
      operations: { status: "complete", content: "" },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
    },
  };
}

test("beginPendingCreatorProposal preserves committed recommendations on re-run", () => {
  const input: CreatorsSectionData = {
    phase: "proposal",
    recommendations: {
      creatorIds: ["inf:keep-1"],
      selectedReasoning: [],
    },
    recommendationsDisplay: "@keep",
    vendorDecisions: { "inf:keep-1": "approved" },
  };

  const next = beginPendingCreatorProposal(input);
  assert.deepEqual(next.recommendations?.creatorIds, ["inf:keep-1"]);
  assert.equal(next.recommendationsDisplay, "@keep");
  assert.equal(next.vendorDecisions?.["inf:keep-1"], "approved");
  assert.equal(next.pendingProposal?.status, "generating");
});

test("beginPendingCreatorProposal is a no-op without committed recommendations", () => {
  const input: CreatorsSectionData = { phase: "discovery" };
  const next = beginPendingCreatorProposal(input);
  assert.equal(next.pendingProposal, undefined);
});

test("search-creators running does not strip committed recommendations", () => {
  const campaignObject = baseCampaignObject({
    phase: "proposal",
    recommendations: {
      creatorIds: ["inf:keep-1"],
      selectedReasoning: [],
    },
    vendorDecisions: { "inf:keep-1": "shortlisted" },
  });

  const updated = applyTaskResultToCampaignObject(
    campaignObject,
    {
      taskId: "search-creators",
      status: "running",
      content: "",
    },
    {}
  );

  const data = updated.sections.creators.data as CreatorsSectionData;
  assert.deepEqual(data.recommendations?.creatorIds, ["inf:keep-1"]);
  assert.equal(data.vendorDecisions?.["inf:keep-1"], "shortlisted");
  assert.equal(data.pendingProposal?.status, "generating");
});

test("search-creators with empty extract does not wipe an existing discovery pool", () => {
  const campaignObject = baseCampaignObject({
    phase: "discovery",
    discovery: { creatorIds: ["inf:rooh", "inf:zeina"], total: 82 },
    lastDiscoveryAt: NOW,
  });

  const updated = applyTaskResultToCampaignObject(
    campaignObject,
    {
      taskId: "search-creators",
      status: "completed",
      content: "No creators extracted",
    },
    {}
  );

  const data = updated.sections.creators.data as CreatorsSectionData;
  assert.deepEqual(data.discovery?.creatorIds, ["inf:rooh", "inf:zeina"]);
  assert.equal(data.discovery?.total, 82);
});
