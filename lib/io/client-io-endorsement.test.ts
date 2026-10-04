import assert from "node:assert/strict";
import { test } from "node:test";
import { applyClientIoPrintLayout } from "./client-io-print-layout";

for (const footer of ["qfoot", "doc-footer"]) {
  test(`signature and stamp appear once in ${footer} snapshots without changing issued values`, () => {
    const original = `<html><head><title>Client Insertion Order</title><style data-client-io-print="2"></style></head><body><div class="paper"><div class="doc"><p>Original price USD 1,234.56</p><p>Approved on 4 October 2026</p><div class="${footer}">Original footer</div></div></body></html>`;
    const html = applyClientIoPrintLayout(original);
    assert.equal((html.match(/data-client-io-endorsement="1"/g) || []).length, 1);
    assert.match(html, /alt="Thinkway authorized signature" src="data:image\/png;base64,/);
    assert.match(html, /alt="Thinkway company stamp" src="data:image\/png;base64,/);
    assert.ok(html.indexOf('data-client-io-endorsement="1"') < html.indexOf(`class="${footer}"`));
    assert.match(html, /Original price USD 1,234.56/);
    assert.match(html, /Approved on 4 October 2026/);
    assert.equal(applyClientIoPrintLayout(html), html);
  });
}
test("other document types do not receive Client IO artwork", () => {
  const html = '<html><head><title>Invoice</title></head><body>Invoice</body></html>';
  assert.equal(applyClientIoPrintLayout(html), html);
});
