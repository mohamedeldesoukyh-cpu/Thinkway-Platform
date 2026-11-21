import assert from "node:assert/strict";
import test from "node:test";

import { accessRequiresMfa, mfaRedirectPath, roleRequiresMfa } from "./mfa-policy";

test("assigned accounting managers require MFA regardless of Media role",()=>{
  assert.equal(accessRequiresMfa("viewer",{manage:true}),true);
  assert.equal(accessRequiresMfa("operations",{manage:true}),true);
  assert.equal(accessRequiresMfa("viewer",{manage:false}),false);
  assert.equal(accessRequiresMfa("admin",{manage:false}),true);
});

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
