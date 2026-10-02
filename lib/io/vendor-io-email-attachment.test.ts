import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareApprovedCreatorIoAttachment } from "./vendor-io-email-attachment";

test("Creator approval PDF stamps the sent snapshot and recorded approval date", async () => {
 const attachment = await prepareApprovedCreatorIoAttachment({ document_number:"VIO-2026-50", terms_html:"<html><body>Selected creator terms</body></html>", approved_at:"2026-09-28T12:00:00Z" }, async html => {
  assert.match(html, /Selected creator terms/);
  assert.match(html, /data-io-approval="approved"/);
  assert.match(html, /28 Sept? 2026/);
  return {ok:true,buffer:Buffer.from("%PDF-approved")};
 });
 assert.equal(attachment.filename,"VIO-2026-50-Approved.pdf");
 assert.equal(attachment.mimeType,"application/pdf");
});
test("Missing snapshot or invalid PDF cannot produce a misleading confirmation attachment", async () => {
 await assert.rejects(()=>prepareApprovedCreatorIoAttachment({document_number:"VIO",terms_html:null,approved_at:"2026-09-28T12:00:00Z"}));
 await assert.rejects(()=>prepareApprovedCreatorIoAttachment({document_number:"VIO",terms_html:"<body>Terms</body>",approved_at:"2026-09-28T12:00:00Z"},async()=>({ok:true,buffer:Buffer.from("not a PDF")})));
});
