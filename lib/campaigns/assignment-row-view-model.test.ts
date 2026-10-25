import assert from "node:assert/strict";
import test from "node:test";
import { buildAssignmentRowViewModel } from "./assignment-row-view-model";
import type { AssignmentHierarchyGroup } from "@/lib/domains/campaign/assignment-hierarchy-types";

function group(status: string, actual: string | null): AssignmentHierarchyGroup {
  return {
    line: { id: "line", name: "Creator", revenue: 100, cost: 50, billing_status: "draft", operational_status: "draft" },
    deliverables: [{ id: "deliverable", platform: "instagram", deliverable_type: "instagram_reel", planned_posting_date: "2026-08-14", posts: [{ workflow_status: status, live_date: actual }] }],
    rollups: {},
  } as unknown as AssignmentHierarchyGroup;
}
test("planned dates remain separate and draft actual dates are not shown as confirmed", () => {
  const planned = buildAssignmentRowViewModel(group("draft", "2026-08-14"));
  const blank = buildAssignmentRowViewModel(group("draft", null));
  assert.equal(planned.postingSummary, blank.postingSummary);
  assert.notEqual(planned.plannedPostingSummary, planned.postingSummary);
  const live = buildAssignmentRowViewModel(group("posted", "2026-08-14"));
  assert.equal(live.plannedPostingSummary, live.postingSummary);
  assert.equal(live.plannedPostingSummary, planned.plannedPostingSummary);
});
