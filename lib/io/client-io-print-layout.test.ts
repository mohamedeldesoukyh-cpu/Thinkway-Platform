import assert from "node:assert/strict";
import { test } from "node:test";
import { applyClientIoPrintLayout } from "./client-io-print-layout";
import { prepareClientIoEmailAttachment } from "./client-io-email-attachment";

const saved = '<html><head><title>Client Insertion Order</title><style>@page{size:A4;margin:14mm}</style></head><body><div class="paper"><div class="doc">Saved total EGP 160,825.50</div></div></body></html>';

test("classic snapshot print correction is idempotent and preserves saved body", () => {
  const fixed = applyClientIoPrintLayout(saved);
  assert.equal(applyClientIoPrintLayout(fixed), fixed);
  assert.equal(fixed.split("<body>")[1], saved.split("<body>")[1]);
  assert.match(fixed, /@page\{size:A4;margin:14mm 0\}/);
  assert.equal(applyClientIoPrintLayout('<html><head></head><body>Legacy IO</body></html>'), '<html><head></head><body>Legacy IO</body></html>');
});

test("email replaces stale classic PDF using saved HTML and CSS-owned margins", async () => {
  const db = { storage: { from: () => { throw Error("Stale PDF must not be used"); } } };
  const result = await prepareClientIoEmailAttachment(db as never, {
    document_number: "CIO-2026-0005", generated_pdf_url: "old.pdf", terms_html: saved,
  }, undefined, async (html, options) => {
    assert.match(html, /Saved total EGP 160,825.50/);
    assert.match(html, /data-client-io-print="2"/);
    assert.equal(options?.margin.left, "0mm");
    return { ok: true, buffer: Buffer.from("%PDF-1.7\ncorrected") };
  });
  assert.equal(result.ok, true);
});
