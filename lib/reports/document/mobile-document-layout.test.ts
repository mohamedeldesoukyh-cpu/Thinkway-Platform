import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMobileDocumentLayout, MOBILE_DOCUMENT_STYLES } from "./mobile-document-layout";

test("mobile adaptation preserves saved document content and is idempotent", () => {
  const html = '<html><head><title>Approved IO</title></head><body><p>Approved amount 120,000 EGP</p></body></html>';
  const adapted = applyMobileDocumentLayout(html);
  assert.equal(adapted.split('<body>')[1], html.split('<body>')[1]);
  assert.equal(applyMobileDocumentLayout(adapted), adapted);
  assert.equal((adapted.match(/name="viewport"/g) || []).length, 1);
  assert.ok(MOBILE_DOCUMENT_STYLES.trim().startsWith('@media screen and'));
  assert.ok(!MOBILE_DOCUMENT_STYLES.includes('@page'));
});

test("existing viewport is preserved without duplication", () => {
  const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>Quotation</body></html>';
  assert.equal((applyMobileDocumentLayout(html).match(/name="viewport"/g) || []).length, 1);
});
