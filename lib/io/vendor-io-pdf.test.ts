import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderHtmlToPdf } from "./vendor-io-pdf";

async function main() {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "vendor-io-pdf.ts"),
    "utf8"
  );

  assert.match(
    source,
    /waitUntil:\s*"domcontentloaded"/,
    "PDF setContent must not wait on full load (CDN hang)"
  );
  assert.match(
    source,
    /setRequestInterception\(true\)/,
    "PDF must intercept remote image requests"
  );
  assert.match(
    source,
    /PDF_SET_CONTENT_TIMEOUT_MS\s*=\s*90_000/,
    "Showcase large HTML needs a longer setContent budget"
  );
  assert.match(
    source,
    /document\.fonts\?\.ready/,
    "PDF must wait for fonts before page.pdf"
  );
  assert.match(
    source,
    /fonts\.googleapis\.com|isAllowedPdfFontUrl/,
    "PDF must allow Google Fonts for preview parity"
  );
  assert.match(
    source,
    /waitForDocumentAttribute/,
    "PDF must support waiting for pagination-ready document attributes"
  );
  assert.match(
    source,
    /sizeAutoHeightPages/,
    "PDF must support auto-sizing tall slides (media-plan calendar)"
  );
  assert.match(
    source,
    /isAllowedPdfImageUrl|supabase\.co/,
    "PDF must allow Thinkway storage avatar images when not inlined"
  );
  assert.match(
    source,
    /inlineRemoteImagesInHtml/,
    "PDF must inline remote img tags for all document types before capture"
  );

  // Hanging remote <img> used to fail setContent(waitUntil:load) after 30s.
  const html = `<!doctype html><html><body>
    <h1>Showcase PDF hang regression</h1>
    <img src="https://httpbin.org/delay/60" width="10" height="10" alt="" />
    <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" width="10" height="10" alt="" />
  </body></html>`;
  const started = Date.now();
  const result = await renderHtmlToPdf(html);
  const elapsedMs = Date.now() - started;
  assert.equal(
    result.ok,
    true,
    `PDF should succeed despite hanging remote img (${result.ok ? "" : result.error})`
  );
  assert.ok(elapsedMs < 45_000, `PDF must not wait on remote images (took ${elapsedMs}ms)`);
  if (result.ok) {
    assert.ok(result.buffer.length > 100, "PDF buffer should be non-trivial");
    assert.equal(result.buffer.subarray(0, 4).toString("ascii"), "%PDF");
  }

  console.log("vendor-io-pdf.test.ts: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
