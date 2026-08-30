import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeNextPath } from "./routes";

test("sanitizeNextPath allows relative app paths", () => {
  assert.equal(sanitizeNextPath("/campaigns"), "/campaigns");
  assert.equal(sanitizeNextPath("/finance/invoices?tab=open"), "/finance/invoices?tab=open");
});

test("sanitizeNextPath rejects protocol-relative open redirects", () => {
  assert.equal(sanitizeNextPath("//evil.com"), "/");
  assert.equal(sanitizeNextPath("//evil.com/phish"), "/");
});

test("sanitizeNextPath rejects absolute URLs and schemes", () => {
  assert.equal(sanitizeNextPath("https://evil.com"), "/");
  assert.equal(sanitizeNextPath("http://evil.com"), "/");
  assert.equal(sanitizeNextPath("/https://evil.com"), "/");
  assert.equal(sanitizeNextPath("javascript:alert(1)"), "/");
  assert.equal(sanitizeNextPath("/javascript:alert(1)"), "/");
});

test("sanitizeNextPath rejects backslash and encoded bypasses", () => {
  assert.equal(sanitizeNextPath("/\\evil.com"), "/");
  assert.equal(sanitizeNextPath("/%2F%2Fevil.com"), "/");
  assert.equal(sanitizeNextPath("/%5C%5Cevil.com"), "/");
  assert.equal(sanitizeNextPath("/%09/evil.com"), "/");
});

test("sanitizeNextPath maps public auth paths to home", () => {
  assert.equal(sanitizeNextPath("/login"), "/");
  assert.equal(sanitizeNextPath("/auth/callback"), "/");
  assert.equal(sanitizeNextPath("/auth/mfa"), "/");
});

test("sanitizeNextPath keeps Creator Workspace invite token on /creator-invite", () => {
  assert.equal(
    sanitizeNextPath("/creator-invite?token=abc.def"),
    "/creator-invite?token=abc.def"
  );
  assert.equal(sanitizeNextPath("/creator-invite"), "/creator-invite");
  assert.equal(sanitizeNextPath("/creator-invite/../login"), "/");
});

test("sanitizeNextPath defaults empty/null", () => {
  assert.equal(sanitizeNextPath(null), "/");
  assert.equal(sanitizeNextPath(undefined), "/");
  assert.equal(sanitizeNextPath(""), "/");
  assert.equal(sanitizeNextPath("   "), "/");
});
