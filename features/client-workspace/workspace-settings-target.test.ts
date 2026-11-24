import assert from "node:assert/strict";
import test from "node:test";
import { groupClientWorkspaceChoices, type ClientWorkspaceChoiceRow } from "./workspace-settings-target";

const row = (patch: Partial<ClientWorkspaceChoiceRow>): ClientWorkspaceChoiceRow => ({
  id: "review-1", journey_id: "shared-1", campaign_name: "Summer campaign", source: "shortlist",
  status: "awaiting_review", review_number: 1, created_at: "2026-11-01T00:00:00Z", ...patch,
});

test("linked shortlist and quotation appear once using the latest review", () => {
  const rows = [row({}), row({ id: "review-2", source: "quotation", review_number: 2, created_at: "2026-11-02T00:00:00Z" })];
  const choices = groupClientWorkspaceChoices([...rows, ...rows]);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].reviewId, "review-2");
  assert.equal(choices[0].workspaceId, "shared-1");
});

test("separate campaigns retain independent controls even when names match", () => {
  const choices = groupClientWorkspaceChoices([row({}), row({ id: "review-2", journey_id: "shared-2" })]);
  assert.equal(choices.length, 2);
});

test("stopped and legacy links remain configurable without exposing tokens", () => {
  const choices = groupClientWorkspaceChoices([row({ journey_id: null, status: "revoked" })]);
  assert.equal(choices[0].workspaceId, "review-1");
  assert.match(choices[0].label, /link off/);
  assert.deepEqual(Object.keys(choices[0]).sort(), ["label", "reviewId", "workspaceId"]);
});
