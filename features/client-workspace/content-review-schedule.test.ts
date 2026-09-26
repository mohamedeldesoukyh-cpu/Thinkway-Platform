import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyClientCampaignPerformance, type ClientCampaignPostRow } from "./campaign-execution";
import type { ClientContentReviewItem } from "./content-approval";
import { nextContentExpectation, projectContentReviewSchedule, reviewScheduleToday } from "./content-review-schedule";
import { mergeContentReviewDates, readContentReviewDates, validReviewDate } from "@/lib/services/deliverables/content-review-schedule";

function post(overrides: Partial<ClientCampaignPostRow> = {}): ClientCampaignPostRow {
  return { id: "p1", creatorName: "Creator A", platform: "instagram", platformLabel: "Instagram", deliverable: "Reel", scheduledDate: "2026-10-10", status: "scheduled", live: false, publicationDate: null, contentUrl: null, performance: emptyClientCampaignPerformance(), assignmentDeliverableId: "d1", assignmentPostScheduleId: null, quantity: 1, ...overrides };
}
function asset(overrides: Partial<ClientContentReviewItem> = {}): ClientContentReviewItem {
  return { assetId: "a1", versionId: "v1", versionNumber: 1, campaignHeaderId: "c1", assignmentDeliverableId: "d1", assignmentPostScheduleId: null, creatorName: "Creator A", platform: "instagram", platformLabel: "Instagram", deliverable: "Reel", assetType: "draft_video", assetTypeLabel: "Draft video", medium: "file", fileName: "draft.mp4", mimeType: "video/mp4", uploadedAt: "2026-09-26T12:00:00Z", status: "approval_required", comment: null, canDownloadOriginal: true, externalUrl: null, previewKind: "video", history: [], ...overrides };
}
const today = "2026-09-26";
test("review dates are optional, calendar-valid and never borrowed from publication dates", () => {
  assert.equal(validReviewDate("2026-02-29"), false);
  assert.equal(validReviewDate("2028-02-29"), true);
  assert.equal(validReviewDate("2026-09-26T00:00:00Z"), false);
  const rows = projectContentReviewSchedule([post()], [], new Set(), today);
  assert.equal(rows[0].expectedDate, null);
  assert.equal(rows[0].status, "unconfirmed");
});
test("saving one slot preserves other slots and commercial metadata", () => {
  const old = { pricing: "package", content_review_schedule: { "seq:1": { script: null, draft: "2026-09-25" } } };
  const next = mergeContentReviewDates(old, 2, { script: "2026-09-26", draft: "2026-09-28" }, "user");
  assert.equal(next.pricing, "package");
  assert.deepEqual(readContentReviewDates(next, 1), { script: null, draft: "2026-09-25" });
  assert.deepEqual(readContentReviewDates(next, 2), { script: "2026-09-26", draft: "2026-09-28" });
  assert.deepEqual(readContentReviewDates(next), { script: null, draft: null });
  assert.equal(Object.keys(old.content_review_schedule).length, 1);
});
test("attention comes before upcoming and summary counts the nearest confirmed expectations", () => {
  const rows = projectContentReviewSchedule([
    post({ id: "late", assignmentDeliverableId: "late", expectedDraftDate: "2026-09-25" }),
    post({ id: "future", assignmentDeliverableId: "future", expectedDraftDate: "2026-09-28" }),
    post({ id: "today", assignmentDeliverableId: "today", expectedScriptDate: today, expectedDraftDate: today }),
    post({ expectedDraftDate: "2026-09-20" }),
  ], [asset()], new Set(), today);
  assert.deepEqual(rows.map(row => row.status), ["ready", "delayed", "due_today", "due_today", "upcoming"]);
  assert.deepEqual(nextContentExpectation(rows, today), { date: today, count: 2 });
});
test("uploaded scripts and approved videos take priority over overdue dates", () => {
  const rows = projectContentReviewSchedule([post({ expectedScriptDate: "2026-09-20", expectedDraftDate: "2026-09-21" })], [asset({ status: "approved" })], new Set(["d:d1"]), today);
  assert.deepEqual(rows.map(row => row.status), ["script_ready", "approved"]);
});
test("new draft awaiting approval supersedes an older approved version", () => {
  const rows = projectContentReviewSchedule([post()], [asset({ status: "approved" }), asset({ versionId: "v2", versionNumber: 2 })], new Set(), today);
  assert.equal(rows[0].status, "ready");
  assert.equal(rows[0].content?.versionId, "v2");
});
test("content and script actions stay on the exact child slot", () => {
  const rows = projectContentReviewSchedule([
    post({ quantity: 2, sequenceNumber: 1, assignmentPostScheduleId: "p1" }),
    post({ id: "p2", quantity: 2, sequenceNumber: 2, assignmentPostScheduleId: "p2" }),
  ], [asset({ assignmentPostScheduleId: "p1" })], new Set(["p:p2"]), today);
  assert.equal(rows.find(row => row.post.id === "p1")?.content?.versionId, "v1");
  assert.equal(rows.find(row => row.post.id === "p2" && row.kind === "draft")?.status, "unconfirmed");
  assert.equal(rows.find(row => row.post.id === "p2" && row.kind === "script")?.status, "script_ready");
});
test("changes requested remain visible and published posts do not become late submissions", () => {
  const rows = projectContentReviewSchedule([post(), post({ id: "live", assignmentDeliverableId: "d2", live: true, expectedDraftDate: "2026-09-10" })], [asset({ status: "changes_requested" })], new Set(), today);
  assert.deepEqual(rows.map(row => row.status), ["changes_requested", "published"]);
});
test("today is the Cairo calendar date, including around UTC midnight", () => {
  assert.equal(reviewScheduleToday(new Date("2026-09-25T22:00:00Z")), "2026-09-26");
});
