import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { parsePdfBuffer } from "./index";
import { extractPdfText } from "./pdf-text";
import {
  buildEmptyPdf,
  buildMalformedPdf,
  buildTestPdf,
} from "./pdf-test-fixtures";

function buildIndahashPdfBody(): string {
  const fixturePath = path.join(
    import.meta.dirname,
    "..",
    "fixtures",
    "indahash-nano-sample.txt"
  );
  return readFileSync(fixturePath, "utf8");
}

async function testSmallPdfExtractsIndahashCreators() {
  const buffer = buildTestPdf([buildIndahashPdfBody()]);
  const result = await parsePdfBuffer(buffer, "indaHash");

  assert.equal(result.parser, "indahash-pdf");
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]?.username, "sample_nano_1");
  assert.equal(result.rows[1]?.platform, "tiktok");
}

function buildIndahashSearchExportBody(): string {
  const fixturePath = path.join(
    import.meta.dirname,
    "..",
    "fixtures",
    "indahash-search-export-sample.txt"
  );
  return readFileSync(fixturePath, "utf8");
}

async function testSearchExportPdfExtractsScatteredCreators() {
  const buffer = buildTestPdf([buildIndahashSearchExportBody()]);
  const result = await parsePdfBuffer(buffer, "indaHash");

  assert.equal(result.parser, "indahash-pdf-search");
  assert.equal(result.rows.length, 8, `expected 8, got ${result.rows.length}`);
  assert.equal(result.diagnostics.extractionMethod, "text");
  assert.ok((result.diagnostics.extractedTextLength ?? 0) > 100);
  assert.equal(result.diagnostics.warning, null);
  const handles = result.rows.map((row) => row.username);
  assert.ok(handles.includes("wafasyedofficial"));
  assert.ok(handles.includes("_tamany_officiall"));
}

async function testMultiPagePdfAggregatesCreators() {
  const pageOne =
    "indaHash export\n@page_one Instagram 1000 2.00% Jordan Fashion 70";
  const pageTwo = "@page_two TikTok 2500 3.50% UAE Travel 85";
  const buffer = buildTestPdf([pageOne, pageTwo]);
  const result = await parsePdfBuffer(buffer, "indaHash");

  assert.ok(
    result.parser === "indahash-pdf" || result.parser === "indahash-pdf-heuristic"
  );
  assert.equal(result.rows.length, 2);
  assert.deepEqual(
    result.rows.map((row) => row.username).sort(),
    ["page_one", "page_two"]
  );
}

async function testEmptyPdfReturnsNoCreators() {
  const buffer = buildEmptyPdf();
  const result = await parsePdfBuffer(buffer, "indaHash");

  // Near-zero extracted text → flagged as potential scanned/image PDF.
  assert.equal(result.parser, "pdf-empty-text");
  assert.equal(result.rows.length, 0);
  assert.equal(result.diagnostics.warning != null, true);
  assert.match(result.diagnostics.warning ?? "", /OCR/i);
}

async function testMalformedPdfThrows() {
  const buffer = buildMalformedPdf();
  await assert.rejects(
    () => extractPdfText(buffer),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /invalid pdf|pdf structure/i);
      return true;
    }
  );
}

async function run() {
  await testSmallPdfExtractsIndahashCreators();
  await testSearchExportPdfExtractsScatteredCreators();
  await testMultiPagePdfAggregatesCreators();
  await testEmptyPdfReturnsNoCreators();
  await testMalformedPdfThrows();
}

run()
  .then(() => {
    console.log("lib/discovery-import/parsers/pdf.test.ts — all tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
