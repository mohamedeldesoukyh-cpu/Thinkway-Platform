import assert from "node:assert/strict";
import { test } from "node:test";
import { approvedClientIoHtml, prepareClientIoEmailAttachment } from "./client-io-email-attachment";

const io = { document_number: "CIO-2026-0005", generated_pdf_url: "io/document.pdf", terms_html: "<html><body><h1>Client IO</h1><p>Total EGP 160,825.50</p></body></html>" };
const pdf = Buffer.from("%PDF-1.7\nfixture");
const db = (buffer: Buffer | null) => ({ storage: { from: () => ({ download: async () => ({ data: buffer ? new Blob([new Uint8Array(buffer)]) : null, error: buffer ? null : { message: "not found" } }) }) } });

test("sends the stored PDF without rendering live campaign data", async () => {
  const result = await prepareClientIoEmailAttachment(db(pdf) as never, io, undefined, async () => { throw Error("Should use saved PDF"); });
  assert.ok(result.ok);
  assert.deepEqual(result.attachment.content, pdf);
});

test("recovers missing PDF from the saved generated HTML", async () => {
  let rendered = "";
  const result = await prepareClientIoEmailAttachment(db(null) as never, io, undefined, async html => { rendered = html; return { ok: true, buffer: pdf }; });
  assert.ok(result.ok);
  assert.equal(rendered, io.terms_html);
  assert.equal(result.attachment.mimeType, "application/pdf");
});

test("refuses missing or invalid PDF attachments", async () => {
  assert.equal((await prepareClientIoEmailAttachment(db(null) as never, { ...io, terms_html: null })).ok, false);
  assert.equal((await prepareClientIoEmailAttachment(db(null) as never, io, undefined, async () => ({ ok: false, error: "renderer unavailable" }))).ok, false);
  assert.equal((await prepareClientIoEmailAttachment(db(null) as never, io, undefined, async () => ({ ok: true, buffer: Buffer.from("not a PDF") }))).ok, false);
});

test("approval confirmation renders Approved and the recorded date onto the same IO", async () => {
  let rendered = "";
  const result = await prepareClientIoEmailAttachment(db(pdf) as never, io, "2026-09-23T14:30:00.000Z", async html => { rendered = html; return { ok: true, buffer: pdf }; });
  assert.ok(result.ok);
  assert.equal(result.attachment.filename, "CIO-2026-0005-Approved.pdf");
  assert.match(rendered, /Approved/);
  assert.match(rendered, /Approval date: 23 Sept? 2026, 17:30/);
  assert.match(rendered, /Total EGP 160,825.50/);
  assert.match(rendered, /<body><div data-io-approval=/);
  assert.throws(() => approvedClientIoHtml(io.terms_html, "invalid"));
});
