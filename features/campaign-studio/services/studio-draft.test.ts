import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftState,
} from "@/features/campaign-intelligence/types/section-schemas";

import {
  applyStudioDraftRemovals,
  draftChangeForCreator,
  getStudioDraft,
  outdatedSectionsForDraft,
  stageDraftChange,
  unstageDraftChange,
  withStudioDraft,
} from "./studio-draft";

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

test("staging a removal replaces any prior change for the same creator (inf: normalized)", () => {
  let draft = stageDraftChange(EMPTY, {
    kind: "refresh_intelligence",
    creatorId: "inf:abc",
    stagedAt: NOW,
  });
  draft = stageDraftChange(draft, {
    kind: "remove_creator",
    creatorId: "abc",
    stagedAt: NOW,
  });

  assert.equal(draft.changes.length, 1);
  assert.equal(draft.changes[0]?.kind, "remove_creator");
  assert.ok(draftChangeForCreator(draft, "inf:abc"));
});

test("removing a draft-added creator cancels the add instead of stacking a removal", () => {
  let draft = stageDraftChange(EMPTY, {
    kind: "add_creator",
    creator: { creatorId: "new-1", source: "discovery" },
    stagedAt: NOW,
  });
  draft = stageDraftChange(draft, {
    kind: "remove_creator",
    creatorId: "new-1",
    stagedAt: NOW,
  });

  assert.equal(draft.changes.length, 0);
});

test("unstage drops only the targeted creator's change", () => {
  let draft = stageDraftChange(EMPTY, {
    kind: "remove_creator",
    creatorId: "a",
    stagedAt: NOW,
  });
  draft = stageDraftChange(draft, {
    kind: "remove_creator",
    creatorId: "b",
    stagedAt: NOW,
  });
  draft = unstageDraftChange(draft, "inf:a");

  assert.equal(draft.changes.length, 1);
  assert.equal(draftChangeForCreator(draft, "a"), undefined);
  assert.ok(draftChangeForCreator(draft, "b"));
});

test("slate changes mark budget, mix, and forecast sections outdated; refresh marks fewer", () => {
  const slateDraft = stageDraftChange(EMPTY, {
    kind: "remove_creator",
    creatorId: "a",
    stagedAt: NOW,
  });
  const outdated = outdatedSectionsForDraft(slateDraft);
  assert.ok(outdated.has("budget-planner"));
  assert.ok(outdated.has("creator-mix"));
  assert.ok(outdated.has("kpi-forecast"));

  const refreshDraft = stageDraftChange(EMPTY, {
    kind: "refresh_intelligence",
    creatorId: "a",
    stagedAt: NOW,
  });
  const refreshOutdated = outdatedSectionsForDraft(refreshDraft);
  assert.ok(refreshOutdated.has("kpi-forecast"));
  assert.ok(!refreshOutdated.has("budget-planner"));

  assert.equal(outdatedSectionsForDraft(EMPTY).size, 0);
});

test("withStudioDraft persists the draft and clears it when empty", () => {
  const base = objectWithCreators({ phase: "complete" });
  const draft = stageDraftChange(EMPTY, {
    kind: "remove_creator",
    creatorId: "a",
    stagedAt: NOW,
  });

  const withDraft = withStudioDraft(base, draft);
  assert.equal(getStudioDraft(withDraft).changes.length, 1);

  const cleared = withStudioDraft(withDraft, { changes: [], updatedAt: NOW });
  const clearedData = cleared.sections.creators.data as CreatorsSectionData;
  assert.equal(clearedData.studioDraft, undefined);
});

test("applying removals filters ids, reasoning, and fit scores, and clears the draft", () => {
  const base = objectWithCreators({
    recommendations: {
      creatorIds: ["inf:a", "inf:b", "inf:c"],
      selectedReasoning: [
        { creatorId: "inf:a", whySelected: "x", alternative: "", confidence: 1, evidence: "", tradeoff: "", expectedRole: "Macro", audienceMatch: "", risk: "" },
        { creatorId: "inf:b", whySelected: "y", alternative: "", confidence: 1, evidence: "", tradeoff: "", expectedRole: "Micro", audienceMatch: "", risk: "" },
      ],
      creatorFitScores: { "inf:a": 90, "inf:b": 80 },
    },
    studioDraft: {
      changes: [{ kind: "remove_creator", creatorId: "b", stagedAt: NOW }],
      updatedAt: NOW,
    },
  });

  const result = applyStudioDraftRemovals(base);
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;

  assert.deepEqual(data.recommendations?.creatorIds, ["inf:a", "inf:c"]);
  assert.deepEqual(
    data.recommendations?.selectedReasoning?.map((r) => r.creatorId),
    ["inf:a"]
  );
  assert.deepEqual(Object.keys(data.recommendations?.creatorFitScores ?? {}), ["inf:a"]);
  assert.equal(data.studioDraft, undefined);
  assert.deepEqual(result.removedCreatorIds, ["b"]);
  assert.equal(result.unappliedChanges.length, 0);
});

test("apply keeps changes the engine does not handle yet staged", () => {
  const base = objectWithCreators({
    recommendations: { creatorIds: ["inf:a", "inf:b"] },
    studioDraft: {
      changes: [
        { kind: "remove_creator", creatorId: "a", stagedAt: NOW },
        {
          kind: "add_creator",
          creator: { creatorId: "z", source: "external_url" },
          stagedAt: NOW,
        },
      ],
      updatedAt: NOW,
    },
  });

  const result = applyStudioDraftRemovals(base);
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;

  assert.deepEqual(data.recommendations?.creatorIds, ["inf:b"]);
  assert.equal(data.studioDraft?.changes.length, 1);
  assert.equal(data.studioDraft?.changes[0]?.kind, "add_creator");
});
