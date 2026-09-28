import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { canViewWorkspaceIo, isCurrentWorkspaceIo, sentIoApprovalToken, type WorkspaceIo } from "./client-io-document-policy";

const token = "throwaway-fixture-approval-token";
const now = Date.parse("2026-09-28T12:00:00Z");
const io: WorkspaceIo = {
  id: "fixture-current-io", document_number: "TEST-IO", status: "sent",
  approved_at: null, terms_html: "<body>Saved client terms</body>", generated_pdf_url: null,
  approval_token_hash: createHash("md5").update(token).digest("hex"),
  approval_token_expires_at: "2026-10-28T12:00:00Z",
};
const payload = { approval_url: `https://example.test/io-approval/client?token=${token}` };

test("current drafts can be viewed before sending; sent snapshots remain viewable", () => {
  for (const status of ["draft", "generated"]) assert.equal(canViewWorkspaceIo({ ...io, status, terms_html: null }), true);
  for (const status of ["sent", "under_client_review"]) {
    assert.equal(canViewWorkspaceIo({ ...io, status }), true);
    assert.equal(canViewWorkspaceIo({ ...io, status, terms_html: null }), false);
  }
});
test("approved document requires its saved snapshot and approval date", () => {
  assert.equal(canViewWorkspaceIo({ ...io, status: "approved" }), false);
  assert.equal(canViewWorkspaceIo({ ...io, status: "approved", approved_at: "2026-09-28T10:00:00Z" }), true);
  assert.equal(canViewWorkspaceIo({ ...io, status: "approved", approved_at: "2026-09-28T10:00:00Z", terms_html: null }), false);
});
test("cancelled, rejected and superseded lifecycle states are not current downloadable documents", () => {
  for (const status of ["cancelled", "rejected", "revision_required", "void", "unknown"])
    assert.equal(canViewWorkspaceIo({ ...io, status }), false);
});
test("only the matching current Client IO can be approved or downloaded", () => {
  assert.equal(isCurrentWorkspaceIo(io, io.id), true);
  for (const id of [null, undefined, "another-campaign-io", "older-revision", 1]) assert.equal(isCurrentWorkspaceIo(io, id), false);
  assert.equal(isCurrentWorkspaceIo(null, io.id), false);
});
test("uses only the currently active sent approval token", () => {
  assert.equal(sentIoApprovalToken(io, [payload], now), token);
  assert.equal(sentIoApprovalToken(io, [{ approval_url: "https://example.test/io-approval/client?token=old" }, payload], now), token);
  assert.equal(sentIoApprovalToken({ ...io, approval_token_hash: createHash("md5").update("rotated").digest("hex") }, [payload], now), null);
});
test("expired, consumed, unsent, approved and unreadable IOs cannot be approved", () => {
  for (const status of ["draft", "generated", "approved", "cancelled", "rejected"]) assert.equal(sentIoApprovalToken({ ...io, status }, [payload], now), null);
  assert.equal(sentIoApprovalToken({ ...io, approval_token_hash: null }, [payload], now), null);
  assert.equal(sentIoApprovalToken({ ...io, approval_token_expires_at: new Date(now).toISOString() }, [payload], now), null);
  assert.equal(sentIoApprovalToken({ ...io, terms_html: null }, [payload], now), null);
  assert.equal(sentIoApprovalToken(io, [null, {}, { approval_url: "not-a-url" }, { approval_url: `https://example.test/io-approval/vendor?token=${token}` }], now), null);
});
