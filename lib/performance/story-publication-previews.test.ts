import assert from "node:assert/strict";
import test from "node:test";
import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { selectStoryPreviewAsset } from "./story-publication-previews";

const story = { id: "story", publication_type: "instagram_story", assignment_deliverable_id: "d", assignment_post_schedule_id: "s" } as CampaignPublicationRow;
const asset = { id: "a", assignment_deliverable_id: "d", assignment_post_schedule_id: "s", current_version_id: "v" };
test("story preview uses its exact scheduled story evidence", () => {
  assert.equal(selectStoryPreviewAsset(story, [story], [{ ...asset, id: "other", assignment_post_schedule_id: "other" }, asset]), asset);
});
test("single unscoped story evidence is supported without crossing deliverables", () => {
  const unscoped = { ...asset, assignment_post_schedule_id: null };
  assert.equal(selectStoryPreviewAsset(story, [story], [unscoped]), unscoped);
  assert.equal(selectStoryPreviewAsset(story, [story], [{ ...unscoped, assignment_deliverable_id: "other" }]), undefined);
});
test("ambiguous story evidence and non-story publications are not reused", () => {
  const unscoped = { ...asset, assignment_post_schedule_id: null };
  assert.equal(selectStoryPreviewAsset(story, [story, { ...story, id: "second" }], [unscoped]), undefined);
  assert.equal(selectStoryPreviewAsset(story, [story], [unscoped, { ...unscoped, id: "second" }]), undefined);
  assert.equal(selectStoryPreviewAsset({ ...story, publication_type: "instagram_post" }, [story], [asset]), undefined);
});
