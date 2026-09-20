import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCampaignApprovalRegister } from "./campaign-approval-register";

const io = {
  id: "client-1", document_number: "CIO-1", status: "approved" as const,
  sent_at: "2026-09-01T12:00:00Z", approved_at: "2026-09-02T12:00:00Z",
  approved_by_name: "Client approver", client_name: "Client",
};
const vendor = {
  ...io, id: "vendor-1", document_number: "VIO-1", influencer_name: "Creator",
  approved_by_name: "Operations", delivery_status: "completed" as const,
};

describe("unified campaign approval register", () => {
  it("shows existing Client IO and five manually accepted Vendor IOs without separate requests", () => {
    const result = buildCampaignApprovalRegister([], io, Array.from({ length: 5 }, (_, i) => ({ ...vendor, id: `vendor-${i}` })));
    assert.equal(result.length, 6);
    assert.ok(result.every((row) => row.status === "approved"));
    assert.equal(result.find((row) => row.source_tab === "client-io")?.approved_by_name, "Client approver");
    assert.equal(result.filter((row) => row.source_tab === "vendor-io").length, 5);
    assert.equal(result.find((row) => row.source_id === "vendor-0")?.decided_at, vendor.approved_at);
  });

  it("distinguishes completed delivery from acceptance and drops stale approval metadata after revision", () => {
    const rows = buildCampaignApprovalRegister([], { ...io, status: "under_client_review" }, [
      { ...vendor, status: "sent" },
      { ...vendor, id: "revision", status: "revision_required" },
    ]);
    assert.equal(rows.filter((row) => row.status === "pending").length, 2);
    assert.ok(rows.every((row) => row.approved_by_name === null && row.decided_at === null));
    assert.equal(rows.find((row) => row.source_id === "revision")?.status, "revision_required");
  });

  it("preserves approval requests, omits unissued and superseded IOs, and avoids duplicate IO rows", () => {
    const request = { id: "request", document_number: "APR-1", title: "Billing sign-off", entity_type: "invoice", status: "pending", assigned_to_name: "Finance", due_at: null, decided_at: null };
    const result = buildCampaignApprovalRegister([request], { ...io, status: "draft" }, [
      vendor, vendor,
      { ...vendor, id: "old", is_superseded: true },
      { ...vendor, id: "cancelled", status: "cancelled" },
      { ...vendor, id: "draft", status: "generated", delivery_status: null },
    ]);
    assert.equal(result.length, 2);
    assert.deepEqual(result.find((row) => row.id === "request"), request);
    assert.equal(result.find((row) => row.source_tab === "vendor-io")?.source_id, vendor.id);
  });
});
