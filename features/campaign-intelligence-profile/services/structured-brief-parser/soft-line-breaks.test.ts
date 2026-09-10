/**
 * Soft line breaks inside a Word paragraph were being deleted.
 *
 * Mammoth converts `<w:br/>` (Shift+Enter) to `<br />`, and `htmlToText`
 * stripped it with every other tag and nothing in its place. A stacked block of
 * labelled values came out as one glued string — the Kérastase brief reached
 * Intake as "Brand: KérastaseMarket: EgyptCampaign Duration: 4 Weeks", which is
 * what the operator saw, and every labelled value after the first on such a
 * paragraph was unreadable to the field extractors.
 */

import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

import { parseStructuredBriefDocument } from ".";
import { paragraphWithSoftBreaks } from "../../fixtures/build-kerastase-docx";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Minimal real DOCX carrying one soft-broken paragraph. */
async function buildDocx(bodyXml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

const LINES = [
  "Brand: Kérastase",
  "Market: Egypt",
  "Campaign Duration: 4 Weeks",
  "Total Influencer Budget: EGP 3,000,000",
];

test("a soft-broken paragraph keeps one line per line", async () => {
  const buffer = await buildDocx(paragraphWithSoftBreaks(LINES));
  const parsed = await parseStructuredBriefDocument(buffer, DOCX_MIME, "brief.docx");

  const text = parsed.llmText;
  assert.ok(
    !/Kérastase\s*Market:/.test(text.replace(/\n/g, "")) || text.includes("Kérastase\nMarket:"),
    "the lines must not be glued together"
  );
  for (const line of LINES) {
    assert.ok(
      text.split(/\r?\n/).some((candidate) => candidate.trim() === line),
      `"${line}" must survive as its own line — got:\n${text}`
    );
  }
});

test("the exact glue the operator saw is gone", async () => {
  const buffer = await buildDocx(paragraphWithSoftBreaks(LINES));
  const parsed = await parseStructuredBriefDocument(buffer, DOCX_MIME, "brief.docx");

  assert.ok(
    !parsed.llmText.includes("KérastaseMarket"),
    `still glued: ${parsed.llmText}`
  );
  assert.ok(!parsed.llmText.includes("EgyptCampaign"));
  assert.ok(!parsed.llmText.includes("4 WeeksTotal"));
});

test("a creator mix stated on a soft-broken line is readable", async () => {
  const buffer = await buildDocx(
    paragraphWithSoftBreaks([
      "7. Preferred Creator Mix",
      "Preferred creator mix: Macro / Mid / Micro",
      "Final allocation can be recommended based on budget and reach.",
    ])
  );
  const parsed = await parseStructuredBriefDocument(buffer, DOCX_MIME, "brief.docx");

  assert.ok(
    parsed.llmText
      .split(/\r?\n/)
      .some((line) => /^Preferred creator mix:\s*Macro \/ Mid \/ Micro$/.test(line.trim())),
    `the mix line must stand alone — got:\n${parsed.llmText}`
  );
});
