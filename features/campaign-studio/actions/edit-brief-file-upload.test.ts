/**
 * Edit Brief → Upload brief file — production-path regression.
 *
 * The dialog used FileReader.readAsText() on the selected file. A `.docx` is a
 * ZIP container, so the textarea filled with `PK…[Content_Types].xml…` and
 * binary replacement characters instead of the brief. The fix routes the file
 * through the same canonical parser the Campaign Brief upload flow uses.
 *
 * These tests exercise that parser against real DOCX bytes, then push the
 * extracted text through the extraction the Save path feeds.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { buildTafareehTeaDocx } from "@/features/campaign-intelligence-profile/fixtures/build-tafareeh-docx";
import {
  extractBriefDocumentText,
  isSupportedBriefFile,
  resolveBriefMime,
} from "@/features/campaign-intelligence-profile/services/brief-document-parser";

/** ZIP/OOXML container markers that must never reach the textarea. */
const CONTAINER_MARKERS = [
  "PK",
  "[Content_Types].xml",
  "word/document.xml",
  "�",
];

/** Mirrors the server action: plain text passes through, containers are parsed. */
async function readBriefFile(bytes: Buffer, fileName: string): Promise<string> {
  const mime = resolveBriefMime({ name: fileName, type: "" });
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mime === "text/plain" || mime === "text/markdown" || ext === "txt" || ext === "md") {
    return bytes.toString("utf8").trim();
  }
  return (await extractBriefDocumentText(bytes, mime, fileName)).trim();
}

// 1 — DOCX is decoded as readable text.

test("DOCX: the canonical parser returns readable text, not container bytes", async () => {
  const bytes = await buildTafareehTeaDocx();
  assert.ok(bytes.length > 500, "fixture must be a real, non-trivial DOCX");

  const text = await readBriefFile(bytes, "tafareeh-tea-brief.docx");

  assert.match(text, /Campaign Objective/i);
  assert.match(text, /Build awareness for Tafareeh Tea/i);
  assert.match(text, /Egyptian tea drinkers/i);
});

// 2 — Raw container content cannot reach the textarea.

test("DOCX: reading the same bytes as plain text is what produced the bug", async () => {
  const bytes = await buildTafareehTeaDocx();

  // What FileReader.readAsText() did — kept as the explicit counter-example.
  const naive = bytes.toString("utf8");
  assert.ok(naive.startsWith("PK"), "a DOCX really is a ZIP container");
  assert.match(naive, /\[Content_Types\]\.xml/);
});

test("DOCX: extracted text carries no ZIP or OOXML container markers", async () => {
  const bytes = await buildTafareehTeaDocx();
  const text = await readBriefFile(bytes, "tafareeh-tea-brief.docx");

  for (const marker of CONTAINER_MARKERS) {
    assert.ok(!text.includes(marker), `extracted text must not contain ${JSON.stringify(marker)}`);
  }
  assert.doesNotMatch(text, /<w:[a-z]/i, "no raw WordprocessingML tags");
});

// 3 — TXT / MD behaviour is unchanged.

test("TXT and MD: byte-identical pass-through, blank lines preserved", async () => {
  const brief = "Objective: Build awareness.\n\nMarket: Egypt\n\nTarget Audience:\nTea drinkers.";

  // Blank lines separate labelled blocks — collapsing them would change extraction.
  assert.equal(await readBriefFile(Buffer.from(brief, "utf8"), "brief.txt"), brief);
  assert.equal(await readBriefFile(Buffer.from(brief, "utf8"), "brief.md"), brief);

  const facts = extractCampaignFacts({
    rawMessage: await readBriefFile(Buffer.from(brief, "utf8"), "brief.txt"),
  });
  assert.equal(facts.objective, "Build awareness.");
  assert.equal(facts.audience, "Tea drinkers.");
});

test("file support gate accepts the formats the dialog offers", () => {
  const supported = ["brief.txt", "brief.md", "brief.rtf", "brief.doc", "brief.docx", "brief.pdf", "brief.pptx"];
  for (const name of supported) {
    assert.ok(
      isSupportedBriefFile({ name, type: "" } as File),
      `${name} must be accepted by the shared gate`
    );
  }
  assert.ok(!isSupportedBriefFile({ name: "logo.png", type: "" } as File));
});

// 4 + 5 — the extracted text reaches extraction and yields the expected intelligence.

test("Tafareeh DOCX: extracted text produces the expected campaign intelligence", async () => {
  const bytes = await buildTafareehTeaDocx();
  const text = await readBriefFile(bytes, "tafareeh-tea-brief.docx");

  const facts = extractCampaignFacts({ rawMessage: text });

  assert.equal(
    facts.objective,
    "Build awareness for Tafareeh Tea and encourage people to try and buy the product."
  );
  assert.equal(facts.sources.objective, "brief");
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.equal(
    facts.keyMessage,
    "Rich, strong tea integrated naturally into everyday Egyptian life."
  );
  assert.equal(facts.callToAction, "Try Tafareeh Tea.");
  // A heading-form block keeps each line whole — only an inline list is split.
  assert.deepEqual(facts.deliverables, [
    "1 Instagram Reel and 1 Instagram Story, mirrored to TikTok",
  ]);
  assert.deepEqual(facts.campaignFunnel, ["Awareness", "Interest", "Trial"]);
  assert.deepEqual(facts.toneOfVoice, [
    "Natural",
    "relatable",
    "positive",
    "Egyptian",
    "not overly scripted",
  ]);
  assert.ok(facts.geography?.includes("Egypt"));
  assert.equal(facts.durationWeeks, 2);
});

test("Tafareeh DOCX: no KPI is invented when the brief states no target", async () => {
  const bytes = await buildTafareehTeaDocx();
  const facts = extractCampaignFacts({
    rawMessage: await readBriefFile(bytes, "tafareeh-tea-brief.docx"),
  });

  assert.deepEqual(facts.kpis ?? [], []);
});
