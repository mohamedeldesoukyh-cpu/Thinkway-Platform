import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";

import {
  previewCreatorsSectionFromDraft,
  previewRecommendationsFromDraft,
  previewVendorDecisionsFromDraft,
} from "./studio-draft-preview";
import { applyStudioDraftChanges, stageDraftChange } from "./studio-draft";

const NOW = new Date().toISOString();
const EMPTY: StudioDraftState = { changes: [], updatedAt: "" };

function objectWithCreators(data: CreatorsSectionData): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      creators: { status: "complete", content: "", data },
    },
    meta: { status: "complete", specialistProgress: [] },
  } as unknown as CampaignObject;
}

function withDraft(object: CampaignObject, draft: StudioDraftState): CampaignObject {
  const creatorsData = object.sections.creators.data as CreatorsSectionData;
  return {
    ...object,
    sections: {
      ...object.sections,
      creators: {
        ...object.sections.creators,
        data: { ...creatorsData, studioDraft: draft },
      },
    },
  };
}

test("preview does not mutate persisted recommendations until apply", () => {
  const base = objectWithCreators({
    recommendations: {
      creatorIds: ["inf:a", "inf:b"],
      selectedReasoning: [],
    },
  });

  const draft = stageDraftChange(EMPTY, {
    kind: "remove_creator",
    creatorId: "b",
    stagedAt: NOW,
  });

  const preview = previewRecommendationsFromDraft(
    (base.sections.creators.data as CreatorsSectionData).recommendations,
    draft.changes
  );
  const persisted = (base.sections.creators.data as CreatorsSectionData).recommendations?.creatorIds;

  assert.deepEqual(preview.creatorIds, ["inf:a"]);
  assert.deepEqual(persisted, ["inf:a", "inf:b"]);
});

test("shortlist replace is preview-only until apply", () => {
  const base = objectWithCreators({
    recommendations: { creatorIds: ["inf:a"], selectedReasoning: [] },
  });

  const draft = stageDraftChange(EMPTY, {
    kind: "replace_shortlist",
    payload: {
      shortlistId: "sl-1",
      recommendations: {
        creatorIds: ["inf:x", "inf:y"],
        selectedReasoning: [],
      },
    },
    stagedAt: NOW,
  });

  const preview = previewCreatorsSectionFromDraft(withDraft(base, draft), draft);
  const persisted = (base.sections.creators.data as CreatorsSectionData).recommendations?.creatorIds;

  assert.deepEqual(preview.recommendations?.creatorIds, ["inf:x", "inf:y"]);
  assert.deepEqual(persisted, ["inf:a"]);
});

test("approve and reject decisions stage in preview only", () => {
  const draft = stageDraftChange(
    stageDraftChange(EMPTY, {
      kind: "approve_creator",
      creatorId: "inf:a",
      stagedAt: NOW,
    }),
    { kind: "reject_creator", creatorId: "inf:b", stagedAt: NOW }
  );

  const decisions = previewVendorDecisionsFromDraft({}, draft.changes);
  assert.equal(decisions["inf:a"], "approved");
  assert.equal(decisions["inf:b"], "rejected");
});

test("apply commits shortlist replace and clears draft", () => {
  const base = objectWithCreators({
    recommendations: { creatorIds: ["inf:a"], selectedReasoning: [] },
    studioDraft: {
      changes: [
        {
          kind: "replace_shortlist",
          payload: {
            shortlistId: "sl-1",
            recommendations: { creatorIds: ["inf:z"], selectedReasoning: [] },
          },
          stagedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
  });

  const result = applyStudioDraftChanges(base);
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.deepEqual(data.recommendations?.creatorIds, ["inf:z"]);
  assert.equal(data.studioDraft, undefined);
  assert.equal(data.linkedShortlistId, "sl-1");
});
