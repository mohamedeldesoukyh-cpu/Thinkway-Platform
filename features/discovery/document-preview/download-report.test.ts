import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchReportDownload, reportDownloadFilename } from "./download-report";

test("preserves the server filename, including Arabic", () => {
  assert.equal(reportDownloadFilename("attachment; filename=\"report.pdf\"; filename*=UTF-8''%D8%B9%D8%B1%D8%B6.pdf", "fallback.pdf"), "عرض.pdf");
  assert.equal(reportDownloadFilename('attachment; filename="report.pdf"; filename*=UTF-8\'\'%broken', "fallback.pdf"), "report.pdf");
});

test("surfaces failed exports and rate limits instead of saving them", async t => {
  const mock = t.mock.method(globalThis, "fetch");
  mock.mock.mockImplementation(async () => Response.json({error:"PDF generation unavailable. Please retry."}, {status:503}));
  await assert.rejects(fetchReportDownload("/export"), /PDF generation unavailable/);
  mock.mock.mockImplementation(async () => Response.json({error:"rate_limit_exceeded"}, {status:429,headers:{"Retry-After":"10"}}));
  await assert.rejects(fetchReportDownload("/export"), /10s/);
  mock.mock.mockImplementation(async () => new Response("%PDF", {headers:{"Content-Type":"application/pdf"}}));
  assert.equal(await (await fetchReportDownload("/export")).text(), "%PDF");
});
