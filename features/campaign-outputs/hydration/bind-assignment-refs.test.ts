import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { AssignmentHierarchy } from "@/lib/domains/campaign/assignment-hierarchy-types";

import { bindAssignmentRefsOntoCampaignObject } from "./bind-assignment-refs";
import { emptyCampaignObject } from "./hydrate";

function objectWithCreator(creatorId: string): CampaignObject {
  const base = emptyCampaignObject();
  return {
    ...base,
    sections: {
      ...base.sections,
      creators: {
        ...base.sections.creators,
        data: {
          recommendations: {
            creatorIds: [creatorId],
            selectedReasoning: [
              {
                creatorId,
                displayName: "Layla",
                whySelected: "test",
                expectedRole: "Hero",
                audienceMatch: "",
                risk: "",
                alternative: "",
                confidence: 1,
                evidence: "",
                tradeoff: "",
              },
            ],
          },
        },
      },
    },
  };
}

test("bindAssignmentRefsOntoCampaignObject stamps campaignLineId by influencer", () => {
  const hierarchy = {
    groups: [
      {
        line: { id: "line-9", influencer_id: "inf-1", influencer_name: "Layla" },
        deliverables: [
          {
            id: "d9",
            posts: [{ id: "p9" }],
          },
        ],
      },
    ],
  } as unknown as AssignmentHierarchy;

  const next = bindAssignmentRefsOntoCampaignObject(objectWithCreator("inf-1"), hierarchy);
  const reasoning = (
    next.sections.creators?.data as {
      recommendations?: { selectedReasoning?: Array<{ campaignLineId?: string }> };
    }
  ).recommendations?.selectedReasoning?.[0];
  assert.equal(reasoning?.campaignLineId, "line-9");
});
