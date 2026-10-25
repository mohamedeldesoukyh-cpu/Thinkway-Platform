import assert from "node:assert/strict";
import test from "node:test";
import { plannedPostingDate, validPostingDate, formatPlannedPostingDates } from "./planned-posting-date";
import { buildClientIoAssignmentSnapshot } from "@/lib/io/client-io-assignment-snapshot";
test("planned dates never fall back to actual publication dates", () => {
  assert.equal(plannedPostingDate({ live_date: "2026-08-14", publication_live_date: "2026-08-14" }), null);
  assert.equal(plannedPostingDate({ planned_posting_date: "2026-08-14", publication_live_date: "2026-08-14" }), "2026-08-14");
  assert.equal(plannedPostingDate({ planned_posting_date: null, live_date: "2026-08-14" }), null);
  assert.equal(validPostingDate("2026-02-30"), false);
  assert.equal(formatPlannedPostingDates(["2026-08-14"]), "14 Aug 2026");
  assert.equal(formatPlannedPostingDates([]), "—");
});
test("client IO snapshots retain distinct planned and actual dates, including when equal", () => {
  for (const actual of ["2026-08-14", "2026-08-20"]) {
    const snapshot = buildClientIoAssignmentSnapshot({ selectedCampaignLineIds: ["line"], lines: [], deliverables: [{ platform: "instagram", deliverable_type: "instagram_reel", quantity: 1, campaign_line_id: "line", sort_order: 0, planned_posting_date: "2026-08-14", live_date: actual }] });
    assert.equal(snapshot.deliverables[0].planned_posting_date, "2026-08-14");
    assert.equal(snapshot.deliverables[0].live_date, actual);
  }
});
