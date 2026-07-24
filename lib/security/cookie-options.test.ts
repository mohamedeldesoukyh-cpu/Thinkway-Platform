import assert from "node:assert/strict";
import test from "node:test";

import {
  auditSupabaseCookieFlags,
  getSupabaseCookieOptions,
  mergeSupabaseCookieOptions,
} from "./cookie-options";

test("Supabase cookie flags keep HttpOnly false for browser client compatibility", () => {
  const flags = auditSupabaseCookieFlags();
  assert.equal(flags.httpOnly, false);
  assert.equal(flags.sameSite, "lax");
  assert.equal(flags.path, "/");
  assert.match(flags.httpOnlyRationale, /browser client/i);
});

test("getSupabaseCookieOptions sets Secure in production", () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const options = getSupabaseCookieOptions();
    assert.equal(options.secure, true);
    assert.equal(options.httpOnly, false);
    assert.equal(options.sameSite, "lax");
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test("mergeSupabaseCookieOptions never enables HttpOnly", () => {
  const merged = mergeSupabaseCookieOptions({ httpOnly: true as unknown as false });
  assert.equal(merged.httpOnly, false);
});
