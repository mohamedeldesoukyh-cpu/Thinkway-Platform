import assert from "node:assert/strict";
import test from "node:test";

import {
  applySecurityHeaders,
  buildApiSecurityHeaders,
  buildDocumentSecurityHeaders,
} from "./security-headers";

const REQUIRED = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "X-Frame-Options",
  "Cross-Origin-Opener-Policy",
  "Cross-Origin-Resource-Policy",
] as const;

test("document security headers include required set", () => {
  const headers = buildDocumentSecurityHeaders();
  for (const key of REQUIRED) {
    assert.ok(headers[key], `missing ${key}`);
  }
  assert.match(headers["Content-Security-Policy"]!, /frame-ancestors 'none'/);
  assert.match(headers["Content-Security-Policy"]!, /worker-src 'self' blob:/);
  assert.match(headers["Content-Security-Policy"]!, /media-src 'self' blob:/);
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  // COEP intentionally omitted for document responses (cross-origin media).
  assert.equal("Cross-Origin-Embedder-Policy" in headers, false);
});

test("API headers tighten CORP to same-origin", () => {
  const headers = buildApiSecurityHeaders();
  assert.equal(headers["Cross-Origin-Resource-Policy"], "same-origin");
});

test("applySecurityHeaders does not overwrite existing values", () => {
  const headers = new Headers({ "X-Frame-Options": "SAMEORIGIN" });
  applySecurityHeaders(headers);
  assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
  assert.ok(headers.get("Content-Security-Policy"));
});
