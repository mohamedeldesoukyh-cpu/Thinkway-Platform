import assert from "node:assert/strict";
import test from "node:test";

import { mfaRedirectPath, roleRequiresMfa } from "./mfa-policy";

test("roleRequiresMfa covers privileged roles only", () => {
  assert.equal(roleRequiresMfa("super_admin"), true);
  assert.equal(roleRequiresMfa("admin"), true);
  assert.equal(roleRequiresMfa("finance"), true);
  assert.equal(roleRequiresMfa("operations"), false);
  assert.equal(roleRequiresMfa("viewer"), false);
  assert.equal(roleRequiresMfa(null), false);
});

test("mfaRedirectPath builds enroll vs challenge URLs", () => {
  assert.equal(
    mfaRedirectPath("mfa_enroll_required", "/settings/security"),
    "/auth/mfa/enroll?next=%2Fsettings%2Fsecurity"
  );
  assert.equal(
    mfaRedirectPath("mfa_challenge_required", "/"),
    "/auth/mfa?next=%2F"
  );
});
