import assert from "node:assert/strict";
import test from "node:test";

import {
  generateInviteToken,
  hashInviteToken,
  inviteTokenHashesEqual,
} from "./invite-token";

test("generateInviteToken returns high-entropy unique values", () => {
  const a = generateInviteToken();
  const b = generateInviteToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
});

test("hashInviteToken uses SHA-256 hex when no secret", () => {
  const prev = process.env.INVITE_TOKEN_SECRET;
  delete process.env.INVITE_TOKEN_SECRET;
  try {
    const hash = hashInviteToken("sample-token-value");
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, hashInviteToken("sample-token-value"));
    assert.notEqual(hash, "sample-token-value");
  } finally {
    if (prev === undefined) delete process.env.INVITE_TOKEN_SECRET;
    else process.env.INVITE_TOKEN_SECRET = prev;
  }
});

test("hashInviteToken uses HMAC when INVITE_TOKEN_SECRET is set", () => {
  const prev = process.env.INVITE_TOKEN_SECRET;
  process.env.INVITE_TOKEN_SECRET = "unit-test-secret";
  try {
    const hash = hashInviteToken("sample-token-value");
    assert.match(hash, /^[a-f0-9]{64}$/);
    delete process.env.INVITE_TOKEN_SECRET;
    assert.notEqual(hash, hashInviteToken("sample-token-value"));
  } finally {
    if (prev === undefined) delete process.env.INVITE_TOKEN_SECRET;
    else process.env.INVITE_TOKEN_SECRET = prev;
  }
});

test("inviteTokenHashesEqual is constant-time equality for digests", () => {
  const hash = hashInviteToken("abc");
  assert.equal(inviteTokenHashesEqual(hash, hash), true);
  assert.equal(inviteTokenHashesEqual(hash, hashInviteToken("other")), false);
});
