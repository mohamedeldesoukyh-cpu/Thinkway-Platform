import assert from "node:assert/strict";
import test from "node:test";

import { authorizeReadyDetailRequest, isReadyAdminRole } from "./ready-auth";

function headers(map: Record<string, string>) {
  return {
    get(name: string) {
      return map[name.toLowerCase()] ?? map[name] ?? null;
    },
  };
}

test("authorizeReadyDetailRequest requires configured secret", () => {
  const prev = process.env.READY_API_SECRET;
  delete process.env.READY_API_SECRET;
  try {
    assert.equal(
      authorizeReadyDetailRequest({
        headers: headers({ "x-ready-api-secret": "x" }),
      }),
      false
    );
  } finally {
    if (prev === undefined) delete process.env.READY_API_SECRET;
    else process.env.READY_API_SECRET = prev;
  }
});

test("authorizeReadyDetailRequest accepts x-ready-api-secret and Bearer", () => {
  const prev = process.env.READY_API_SECRET;
  process.env.READY_API_SECRET = "ready-secret";
  try {
    assert.equal(
      authorizeReadyDetailRequest({
        headers: headers({ "x-ready-api-secret": "ready-secret" }),
      }),
      true
    );
    assert.equal(
      authorizeReadyDetailRequest({
        headers: headers({ authorization: "Bearer ready-secret" }),
      }),
      true
    );
    assert.equal(
      authorizeReadyDetailRequest({
        headers: headers({ "x-ready-api-secret": "wrong" }),
      }),
      false
    );
  } finally {
    if (prev === undefined) delete process.env.READY_API_SECRET;
    else process.env.READY_API_SECRET = prev;
  }
});

test("isReadyAdminRole only allows admin and super_admin", () => {
  assert.equal(isReadyAdminRole("admin"), true);
  assert.equal(isReadyAdminRole("super_admin"), true);
  assert.equal(isReadyAdminRole("finance"), false);
  assert.equal(isReadyAdminRole("viewer"), false);
  assert.equal(isReadyAdminRole(null), false);
});
