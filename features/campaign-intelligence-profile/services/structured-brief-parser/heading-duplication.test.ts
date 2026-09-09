/**
 * Structured brief parsing — heading duplication regression.
 *
 * A heading used to be stored twice in the same section: once as
 * `section.title` and again as a `heading` block. When the document's first
 * line was a heading it was stored a third time as `document.title`, so
 * serialization emitted the same words three times:
 *
 *   Tafareeh Tea – Campaign Brief
 *   Tafareeh Tea – Campaign Brief
 *   Tafareeh Tea – Campaign Brief
 *   Campaign Objective
 *   Campaign Objective
 *   Build awareness for Tafareeh Tea …
 *
 * The fix is in the parsers: a heading is represented once, as the section
 * title, and a leading title-only section becomes the document title. The
 * serializer is unchanged — given a correct document it already produced
 * correct text.
 *
 * This is identity-based, not string deduplication: text the source document
 * genuinely repeats must still be repeated.
 */

import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";

import { profileToCampaignFacts } from "../profile-to-facts";
import { runCampaignIntelligencePipeline } from "../run-intelligence-pipeline";
import { parseStructuredBriefDocument } from "./index";
import { parsePlainTextStructured } from "./parse-text";
import { serializeStructuredBrief, structuredBriefToPlainText } from "./serialize";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const TITLE = "Tafareeh Tea – Campaign Brief";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const heading = (text: string, style = "Heading1") =>
  `<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
const paragraph = (text: string) =>
  `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
const cell = (text: string) =>
  `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:tc>`;

/**
 * The real Tafareeh shape: a heading-styled document title, heading-labelled
 * sections, and optionally a table. The table routes the file down the OOXML
 * branch; without one it takes the mammoth-HTML branch. Both branches must
 * emit the title exactly once.
 */
async function buildTafareehDocx(
  options: { withTable?: boolean; intro?: string } = {}
): Promise<Buffer> {
  const body = [
    // Heading1, not "Title": mammoth renders a Title-styled paragraph as <p>,
    // which never reaches the branch's title assignment. The real brief uses a
    // real heading, so the fixture must too.
    heading(TITLE),
    options.intro ? paragraph(options.intro) : "",
    heading("Campaign Objective"),
    paragraph("Build awareness for Tafareeh Tea and encourage people to try and buy the product."),
    heading("Market"),
    paragraph("Egypt"),
    heading("Campaign Duration"),
    paragraph("2 weeks"),
    heading("Target Audience"),
    paragraph("Egyptian tea drinkers, mainly young adults and families."),
    heading("Key Message"),
    paragraph("Rich, strong tea integrated naturally into everyday Egyptian life."),
    heading("Call to Action"),
    paragraph("Try Tafareeh Tea."),
    heading("Campaign Goal"),
    paragraph("Awareness -> Interest -> Trial"),
    heading("Creator Deliverables"),
    paragraph("1 Instagram Reel and 1 Instagram Story, mirrored to TikTok."),
    options.withTable === false
      ? ""
      : `<w:tbl><w:tr>${cell("Brand")}${cell("Tafareeh Tea")}</w:tr></w:tbl>`,
  ]
    .filter(Boolean)
    .join("\n");

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
  );
  zip
    .folder("_rels")!
    .file(
      ".rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
    );
  zip
    .folder("word")!
    .file(
      "document.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
    );

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// 1–6 — each heading appears exactly once, on the OOXML branch.

test("OOXML DOCX: the document title appears once in plainText and llmText", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx(),
    DOCX_MIME,
    "tafareeh.docx"
  );

  assert.equal(parsed.document.parserMode, "docx_ooxml_tables");
  assert.equal(parsed.document.title, TITLE);
  assert.equal(occurrences(parsed.plainText, TITLE), 1, "title must appear once in plainText");
  assert.equal(occurrences(parsed.llmText, TITLE), 1, "title must appear once in llmText");
});

test("OOXML DOCX: each section label appears exactly once", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx(),
    DOCX_MIME,
    "tafareeh.docx"
  );

  for (const label of [
    "Campaign Objective",
    "Market",
    "Campaign Duration",
    "Target Audience",
    "Key Message",
    "Call to Action",
    "Campaign Goal",
    "Creator Deliverables",
  ]) {
    assert.equal(occurrences(parsed.plainText, label), 1, `${label} once in plainText`);
    assert.equal(occurrences(parsed.llmText, label), 1, `${label} once in llmText`);
  }
});

test("OOXML DOCX: a heading is stored once — as the section title, not also a block", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx(),
    DOCX_MIME,
    "tafareeh.docx"
  );

  const headingBlocks = parsed.document.sections.flatMap((section) =>
    section.blocks.filter((block) => block.type === "heading")
  );
  assert.deepEqual(headingBlocks, [], "no heading block may duplicate a section title");
  assert.ok(
    parsed.document.sections.some((section) => section.title === "Campaign Objective"),
    "the label survives as the section title"
  );
});

// 7–8 — every value survives.

test("OOXML DOCX: all values remain intact", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx(),
    DOCX_MIME,
    "tafareeh.docx"
  );

  for (const value of [
    "Build awareness for Tafareeh Tea and encourage people to try and buy the product.",
    "Egypt",
    "2 weeks",
    "Egyptian tea drinkers, mainly young adults and families.",
    "Rich, strong tea integrated naturally into everyday Egyptian life.",
    "Try Tafareeh Tea.",
    "Awareness -> Interest -> Trial",
    "1 Instagram Reel and 1 Instagram Story, mirrored to TikTok.",
    "Tafareeh Tea",
  ]) {
    assert.ok(parsed.plainText.includes(value), `plainText keeps: ${value}`);
    assert.ok(parsed.llmText.includes(value), `llmText keeps: ${value}`);
  }
});

test("OOXML DOCX: the exact expected document shape", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx({ withTable: false }),
    DOCX_MIME,
    "tafareeh.docx"
  );

  assert.equal(
    parsed.plainText.split("\n").slice(0, 7).join("\n"),
    [
      TITLE,
      "Campaign Objective",
      "Build awareness for Tafareeh Tea and encourage people to try and buy the product.",
      "Market",
      "Egypt",
      "Campaign Duration",
      "2 weeks",
    ].join("\n")
  );
});

// 9 — identity-based, not string deduplication.

test("genuinely repeated body text stays repeated", async () => {
  const repeated = "Creators must disclose the partnership in every post.";
  const text = [
    TITLE,
    "",
    "Campaign Objective",
    "Build awareness.",
    "",
    "Compliance",
    repeated,
    repeated,
  ].join("\n");

  const document = parsePlainTextStructured(text, "pdf", "pdf_text");
  const plain = structuredBriefToPlainText(document);

  assert.equal(occurrences(plain, repeated), 2, "the source repeats it, so the output must too");
  assert.equal(occurrences(plain, TITLE), 1);
  assert.equal(occurrences(plain, "Compliance"), 1);
});

// 12 — mammoth-HTML branch (a table-less DOCX takes this path).

test("mammoth-HTML DOCX: a Heading1 title appears once — the reported case", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx({ withTable: false }),
    DOCX_MIME,
    "tafareeh.docx"
  );

  assert.equal(parsed.document.parserMode, "docx_mammoth_html");
  for (const label of ["Campaign Objective", "Market", "Campaign Duration"]) {
    assert.equal(occurrences(parsed.plainText, label), 1, `${label} once in plainText`);
    assert.equal(occurrences(parsed.llmText, label), 1, `${label} once in llmText`);
  }
  assert.equal(occurrences(parsed.plainText, TITLE), 1);
  assert.ok(parsed.plainText.includes("Egyptian tea drinkers, mainly young adults and families."));
});

// 13 — plain-text / PDF branch.

test("PDF and plain-text: labels appear once and no heading is stored twice", () => {
  const text = [
    TITLE,
    "",
    "Campaign Objective",
    "Build awareness for Tafareeh Tea.",
    "",
    "Campaign Duration",
    "2 weeks",
  ].join("\n");

  const document = parsePlainTextStructured(text, "pdf", "pdf_text");
  const plain = structuredBriefToPlainText(document);
  const llm = serializeStructuredBrief(document);

  // The plain-text heuristic only treats a line as a heading when it matches
  // /^[A-Z][\w\s/&'-]{2,40}$/ — an en dash is not in that set, so this title
  // stays a paragraph and there is nothing to lift. It must still appear once.
  const headingBlocks = document.sections.flatMap((section) =>
    section.blocks.filter((block) => block.type === "heading")
  );
  assert.deepEqual(headingBlocks, []);

  for (const label of ["Campaign Objective", "Campaign Duration"]) {
    assert.equal(occurrences(plain, label), 1);
    assert.equal(occurrences(llm, label), 1);
  }
  assert.equal(occurrences(plain, TITLE), 1);
  assert.ok(plain.includes("Build awareness for Tafareeh Tea."));
  assert.ok(plain.includes("2 weeks"));
});

// 10–11 — llmText still drives the canonical pipeline.

test("llmText still produces the expected Tafareeh intelligence", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx(),
    DOCX_MIME,
    "tafareeh.docx"
  );

  const { profile } = await runCampaignIntelligencePipeline({
    briefText: parsed.llmText,
    briefTextSource: "upload",
    structuredParserOutput: parsed.document,
  });
  const facts = profileToCampaignFacts(profile);

  assert.equal(facts.brandName, "Tafareeh Tea");
  assert.match(facts.objective ?? "", /Build awareness for Tafareeh Tea/i);
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.equal(
    facts.keyMessage,
    "Rich, strong tea integrated naturally into everyday Egyptian life."
  );
  assert.equal(facts.callToAction, "Try Tafareeh Tea.");
  assert.deepEqual(facts.campaignFunnel, ["Awareness", "Interest", "Trial"]);
  assert.deepEqual(facts.deliverables, [
    "1 Instagram Reel and 1 Instagram Story, mirrored to TikTok",
  ]);
  assert.ok(facts.geography?.includes("Egypt"));
  assert.equal(facts.durationWeeks, 2);

  // No measurable target in the brief — nothing may be invented.
  assert.deepEqual(facts.kpis ?? [], []);
});

test("the de-duplicated llmText extracts identically through the heuristic", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx(),
    DOCX_MIME,
    "tafareeh.docx"
  );
  const facts = extractCampaignFacts({ rawMessage: parsed.llmText });

  assert.equal(facts.sources.objective, "brief");
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.deepEqual(facts.kpis ?? [], []);
});

// Compatibility — persisted rows still carry the old duplicated shape.

test("an already-persisted duplicated document still extracts correctly", () => {
  // Exactly what rows saved before this fix contain.
  const legacyLlmText = [
    TITLE,
    "",
    `Section: ${TITLE}`,
    TITLE,
    "",
    "Section: Campaign Objective",
    "Campaign Objective",
    "Build awareness for Tafareeh Tea and encourage people to try and buy the product.",
    "",
    "Section: Target Audience",
    "Target Audience",
    "Egyptian tea drinkers, mainly young adults and families.",
  ].join("\n");

  const facts = extractCampaignFacts({ rawMessage: legacyLlmText });

  assert.match(facts.objective ?? "", /Build awareness for Tafareeh Tea/i);
  assert.equal(facts.sources.objective, "brief");
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
});


test("plain text: a heading-shaped title is lifted to the document title once", () => {
  const text = ["Tafareeh Tea Campaign Brief", "", "Campaign Objective", "Build awareness."].join(
    "\n"
  );

  const document = parsePlainTextStructured(text, "pdf", "pdf_text");

  assert.equal(document.title, "Tafareeh Tea Campaign Brief");
  assert.equal(
    occurrences(structuredBriefToPlainText(document), "Tafareeh Tea Campaign Brief"),
    1
  );
  assert.equal(
    occurrences(serializeStructuredBrief(document), "Tafareeh Tea Campaign Brief"),
    1
  );
  assert.ok(structuredBriefToPlainText(document).includes("Build awareness."));
});


// The remaining title duplication after the heading fix, and its latent twin.

test("mammoth-HTML: document.title and sections[0].title are never both set", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx({ withTable: false }),
    DOCX_MIME,
    "tafareeh.docx"
  );

  assert.equal(parsed.document.parserMode, "docx_mammoth_html");
  assert.equal(parsed.document.title, TITLE, "the title-only section is lifted");
  assert.ok(
    !parsed.document.sections.some((section) => section.title === TITLE),
    "the lifted section must not remain as a section too"
  );
  assert.equal(occurrences(parsed.plainText, TITLE), 1);
  assert.equal(occurrences(parsed.llmText, TITLE), 1);
});

test("OOXML: a title with no following content is lifted and appears once", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx(),
    DOCX_MIME,
    "tafareeh.docx"
  );

  assert.equal(parsed.document.parserMode, "docx_ooxml_tables");
  assert.equal(parsed.document.title, TITLE);
  assert.equal(occurrences(parsed.plainText, TITLE), 1);
  assert.equal(occurrences(parsed.llmText, TITLE), 1);
});

test("a title followed by an intro paragraph appears once and keeps the intro", async () => {
  const intro = "Prepared by the Thinkway team, October 2026.";
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx({ intro }),
    DOCX_MIME,
    "tafareeh.docx"
  );

  // The section holds real content, so it keeps its title and stays — and the
  // document is left unnamed rather than repeating that heading.
  assert.equal(parsed.document.title, undefined);
  assert.equal(occurrences(parsed.plainText, TITLE), 1, "title once in plainText");
  assert.equal(occurrences(parsed.llmText, TITLE), 1, "title once in llmText");
  assert.ok(parsed.plainText.includes(intro), "the intro paragraph survives");
  assert.ok(parsed.llmText.includes(intro), "the intro paragraph survives");

  for (const label of ["Campaign Objective", "Market", "Campaign Duration"]) {
    assert.equal(occurrences(parsed.plainText, label), 1, `${label} once`);
    assert.equal(occurrences(parsed.llmText, label), 1, `${label} once`);
  }
  assert.ok(parsed.plainText.includes("Egypt"));
  assert.ok(parsed.plainText.includes("2 weeks"));
});

test("heading identity survives: every label is still reachable as a section title", async () => {
  const parsed = await parseStructuredBriefDocument(
    await buildTafareehDocx({ intro: "Prepared by the Thinkway team." }),
    DOCX_MIME,
    "tafareeh.docx"
  );

  const titles = parsed.document.sections.map((section) => section.title);
  for (const label of ["Campaign Objective", "Market", "Campaign Duration", "Target Audience"]) {
    assert.ok(titles.includes(label), `${label} is still a section title`);
  }
  assert.ok(titles.includes(TITLE), "the retained leading section keeps its own title");
});
