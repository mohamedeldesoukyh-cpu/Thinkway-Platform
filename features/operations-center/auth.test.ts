import assert from "node:assert/strict";
import test from "node:test";

import { canAccessOperationsCenter, OPERATIONS_CENTER_ROLES } from "./roles";

test("Operations Center roles allowlist", () => {
  assert.ok(OPERATIONS_CENTER_ROLES.has("super_admin"));
  assert.ok(OPERATIONS_CENTER_ROLES.has("admin"));
  assert.ok(OPERATIONS_CENTER_ROLES.has("operations"));
  assert.ok(OPERATIONS_CENTER_ROLES.has("devops"));
  assert.equal(canAccessOperationsCenter("super_admin"), true);
  assert.equal(canAccessOperationsCenter("operations"), true);
  assert.equal(canAccessOperationsCenter("devops"), true);
  assert.equal(canAccessOperationsCenter("finance"), false);
  assert.equal(canAccessOperationsCenter("account_manager"), false);
  assert.equal(canAccessOperationsCenter("client_user"), false);
  assert.equal(canAccessOperationsCenter(null), false);
});
