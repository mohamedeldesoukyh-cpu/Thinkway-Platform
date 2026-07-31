import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getIoApprovalOutcomeView,
  mapApprovalRpcErrorToOutcome,
} from "@/lib/io/io-approval-outcomes";

describe("io approval outcomes", () => {
  it("maps RPC markers to friendly outcome codes", () => {
    assert.equal(
      mapApprovalRpcErrorToOutcome("APPROVAL_ALREADY_APPROVED"),
      "already_approved"
    );
    assert.equal(mapApprovalRpcErrorToOutcome("APPROVAL_EXPIRED"), "expired");
    assert.equal(
      mapApprovalRpcErrorToOutcome("APPROVAL_SUPERSEDED"),
      "superseded"
    );
    assert.equal(mapApprovalRpcErrorToOutcome("APPROVAL_INVALID"), "invalid");
    assert.equal(mapApprovalRpcErrorToOutcome("something else"), "invalid");
  });

  it("provides professional copy for already approved / expired / superseded", () => {
    const already = getIoApprovalOutcomeView("already_approved");
    assert.equal(already.title, "Already Approved");
    assert.match(already.body, /already been approved/i);
    assert.match(already.body, /No further action/i);

    const expired = getIoApprovalOutcomeView("expired");
    assert.equal(expired.title, "Expired");
    assert.match(expired.body, /has expired/i);

    const superseded = getIoApprovalOutcomeView("superseded");
    assert.equal(superseded.title, "Superseded");
    assert.match(superseded.body, /newer version/i);
  });
});
