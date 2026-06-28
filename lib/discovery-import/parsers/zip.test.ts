import assert from "node:assert/strict";

import JSZip from "jszip";

import { parseZipBuffer } from "./zip";
import {
  extractZipEntries,
  isSafeZipEntryPath,
  normalizeZipEntryPath,
  ZIP_MAX_UNCOMPRESSED_BYTES,
} from "./zip";

const CSV_SAMPLE = `username,platform,followers,engagement rate,country
creator_one,instagram,10000,3.5,Jordan
creator_two,tiktok,50000,5.2,UAE
`;

async function buildZip(entries: Record<string, string | Buffer>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(entries)) {
    zip.file(path, content);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

function testPathSafety() {
  assert.equal(isSafeZipEntryPath("data/creators.csv"), true);
  assert.equal(isSafeZipEntryPath("../etc/passwd"), false);
  assert.equal(isSafeZipEntryPath("foo/../../secret.csv"), false);
  assert.equal(isSafeZipEntryPath("nested/../../../outside.csv"), false);
  assert.equal(normalizeZipEntryPath("\\folder\\file.csv"), "folder/file.csv");
}

async function testSingleCsvZip() {
  const buffer = await buildZip({ "creators.csv": CSV_SAMPLE });
  const result = await parseZipBuffer(buffer, "Agency Export");

  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0]?.username, "creator_one");
  assert.equal(result.parser.startsWith("zip:"), true);
}

async function testMultipleCsvZipMergesUniqueRows() {
  const csvTwo = `username,platform,followers
creator_three,youtube,9000
creator_one,instagram,12000
`;
  const buffer = await buildZip({
    "batch-a.csv": CSV_SAMPLE,
    "batch-b.csv": csvTwo,
  });
  const result = await parseZipBuffer(buffer, null);

  assert.equal(result.rows.length, 3);
  assert.equal(result.parser, "zip:bundle(2)");
}

async function testAvatarFolderDiagnostics() {
  const buffer = await buildZip({
    "creators.csv": CSV_SAMPLE,
    "images/creator_one.jpg": Buffer.from("fake-image"),
  });
  const result = await parseZipBuffer(buffer, null);

  assert.equal(result.rows.length, 2);
  assert.match(result.diagnostics.warning ?? "", /avatar image/i);
  assert.match(result.diagnostics.warning ?? "", /matching avatar filenames/i);
}

async function testRejectsEmptyDataZip() {
  const buffer = await buildZip({ "readme.txt": "no data here" });
  const result = await parseZipBuffer(buffer, null);

  assert.equal(result.rows.length, 0);
  assert.match(result.diagnostics.warning ?? "", /no CSV or XLSX/i);
}

async function testExtractZipEntriesSizeLimit() {
  const zip = new JSZip();
  const oversized = Buffer.alloc(ZIP_MAX_UNCOMPRESSED_BYTES + 1, 1);
  zip.file("large.csv", oversized);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  await assert.rejects(
    () => extractZipEntries(buffer),
    /uncompressed content exceeds/
  );
}

async function run() {
  testPathSafety();
  await testSingleCsvZip();
  await testMultipleCsvZipMergesUniqueRows();
  await testAvatarFolderDiagnostics();
  await testRejectsEmptyDataZip();
  await testExtractZipEntriesSizeLimit();
  console.log("discovery-import zip parser tests passed");
}

void run();
