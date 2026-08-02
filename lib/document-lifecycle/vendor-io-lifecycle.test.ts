import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveVendorIoLifecycle,
  vendorIoAllowsAction,
  vendorIoBulkSkipReason,
} from "@/lib/document-lifecycle/policies/vendor-io";
import type { DocumentLifecycleSnapshot } from "@/lib/document-lifecycle/types";

function snap(
  overrides: Partial<DocumentLifecycleSnapshot> = {}
): DocumentLifecycleSnapshot {
  return {
    documentType: "vendor_io",
    id: "vio-1",
    status: "generated",
    isSuperseded: false,
    ...overrides,
  };
}

describe("Vendor IO document lifecycle", () => {
  it("Draft / Pending Send allows Send and hides Mark Accepted", () => {
    const draft = resolveVendorIoLifecycle(snap({ status: "draft" }));
    assert.equal(draft.lifecycleState, "draft");
    assert.ok(draft.availableActions.includes("send"));
    assert.ok(!draft.availableActions.includes("mark_accepted"));

    const pending = resolveVendorIoLifecycle(snap({ status: "generated" }));
    assert.equal(pending.lifecycleState, "pending_send");
    assert.ok(pending.availableActions.includes("send"));
  });

  it("Sent enables Mark Accepted and disables Send (bulk skip)", () => {
    const sent = resolveVendorIoLifecycle(snap({ status: "sent" }));
    assert.equal(sent.lifecycleState, "sent");
    assert.ok(sent.availableActions.includes("mark_accepted"));
    assert.ok(sent.availableActions.includes("resend"));
    assert.ok(!sent.availableActions.includes("send"));
    assert.match(
      vendorIoBulkSkipReason(snap({ status: "sent" }), "send") ?? "",
      /already sent|delivered/i
    );
  });

  it("Delivered Manually is a presentation state from delivery fields", () => {
    const resolved = resolveVendorIoLifecycle(
      snap({
        status: "sent",
        deliveryMethod: "manual",
        deliveryStatus: "completed",
      })
    );
    assert.equal(resolved.lifecycleState, "delivered_manually");
    assert.ok(resolved.availableActions.includes("mark_accepted"));
  });

  it("Accepted hides completed actions and keeps View", () => {
    const accepted = resolveVendorIoLifecycle(snap({ status: "approved" }));
    assert.equal(accepted.lifecycleState, "accepted");
    assert.ok(accepted.availableActions.includes("view"));
    assert.ok(!accepted.availableActions.includes("mark_accepted"));
    assert.ok(!accepted.availableActions.includes("send"));
    assert.equal(
      vendorIoBulkSkipReason(snap({ status: "approved" }), "mark_accepted"),
      "Already accepted."
    );
  });

  it("Revision Required exposes regenerate and carries reason for AI/audit", () => {
    const resolved = resolveVendorIoLifecycle(
      snap({
        status: "revision_required",
        lifecycleReasonCode: "creator_price_changed",
        lifecycleReasonDetail: "Creator price changed after document issuance.",
      })
    );
    assert.equal(resolved.lifecycleState, "revision_required");
    assert.ok(resolved.availableActions.includes("regenerate"));
    assert.ok(resolved.availableActions.includes("send_updated_version"));
    assert.ok(!resolved.availableActions.includes("mark_accepted"));
    assert.equal(resolved.reasonCode, "creator_price_changed");
    assert.match(resolved.labels.reason ?? "", /Creator price changed/i);
    assert.equal(resolved.aiHints.outdated, true);
    assert.equal(resolved.aiHints.recommendRegenerate, true);
  });

  it("Cancelled and Superseded are history-only", () => {
    assert.deepEqual(
      resolveVendorIoLifecycle(snap({ status: "cancelled" })).availableActions,
      ["view", "download"]
    );
    assert.equal(
      resolveVendorIoLifecycle(snap({ status: "sent", isSuperseded: true }))
        .lifecycleState,
      "superseded"
    );
    assert.equal(
      vendorIoAllowsAction(snap({ status: "cancelled" }), "send"),
      false
    );
  });
});
