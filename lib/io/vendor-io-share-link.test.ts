import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { currentVendorSigningToken } from "./vendor-io-share-link";

test("sharing only returns the active emailed credential, never rotated, expired or completed IO links", () => {
  const token = "test-signing-credential";
  const io = { status: "sent", is_superseded: false, approval_token_hash: createHash("md5").update(token).digest("hex"), approval_token_expires_at: "2030-01-01" };
  const payloads = [{ approval_url: `https://example.test/io-approval/vendor?signing_token=${token}` }];
  assert.equal(currentVendorSigningToken(io, payloads), token);
  assert.equal(currentVendorSigningToken(io, [{ approval_url: `https://old.example/io-approval/vendor?token=${token}` }]), token);
  assert.equal(currentVendorSigningToken(io, [{ approval_url: "https://example.test/io-approval/vendor?signing_token=old" }]), null);
  assert.equal(currentVendorSigningToken({ ...io, status: "approved" }, payloads), null);
  assert.equal(currentVendorSigningToken({ ...io, is_superseded: true }, payloads), null);
  assert.equal(currentVendorSigningToken({ ...io, approval_token_expires_at: "2000-01-01" }, payloads), null);
  assert.equal(currentVendorSigningToken(io, [null, {}, { approval_url: "invalid" }]), null);
});
