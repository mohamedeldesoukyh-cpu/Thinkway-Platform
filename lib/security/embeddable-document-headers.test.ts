import assert from "node:assert/strict";
import test from "node:test";

import { EMBEDDABLE_DOCUMENT_FRAME_HEADERS } from "./embeddable-document-headers";
import { buildApiSecurityHeaders, buildDocumentSecurityHeaders } from "./security-headers";

test("platform defaults deny framing", () => {
  const docs = buildDocumentSecurityHeaders();
  const api = buildApiSecurityHeaders();
  assert.equal(docs["X-Frame-Options"], "DENY");
  assert.match(docs["Content-Security-Policy"] ?? "", /frame-ancestors 'none'/);
  assert.equal(api["X-Frame-Options"], "DENY");
});

test("embeddable preview HTML allows same-origin framing only", () => {
  assert.equal(EMBEDDABLE_DOCUMENT_FRAME_HEADERS["X-Frame-Options"], "SAMEORIGIN");
  assert.match(
    EMBEDDABLE_DOCUMENT_FRAME_HEADERS["Content-Security-Policy"],
    /frame-ancestors 'self'/
  );
  assert.doesNotMatch(
    EMBEDDABLE_DOCUMENT_FRAME_HEADERS["Content-Security-Policy"],
    /frame-ancestors 'none'/
  );
});
