import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildLorealPremiumSkincareDocx } from "../../fixtures/build-loreal-docx";
import { parseStructuredBriefDocument } from "./index";
import { serializeStructuredBrief } from "./serialize";
import { resolveBriefTextForExtraction } from "../resolve-brief-text";
import { createEmptyCampaignIntelligenceProfile } from "../../types/profile";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "../../fixtures/loreal-premium-skincare-brief.docx");

async function loadDocxBuffer(): Promise<Buffer> {
  try {
    return await readFile(FIXTURE_PATH);
  } catch {
    const buffer = await buildLorealPremiumSkincareDocx();
    await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
    await writeFile(FIXTURE_PATH, buffer);
    return buffer;
  }
}

async function main() {
  const buffer = await loadDocxBuffer();
  assert.ok(buffer.length > 500, "DOCX fixture must have non-trivial byte size");

  const parsed = await parseStructuredBriefDocument(
    buffer,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "loreal-premium-skincare-brief.docx"
  );

  assert.ok(parsed.document.sections.length > 0, "DOCX must produce sections");
  assert.ok(
    parsed.document.sections.some((s) => s.blocks.some((b) => b.type === "table")),
    "DOCX must parse table blocks"
  );

  const tableBlock = parsed.document.sections
    .flatMap((s) => s.blocks)
    .find((b) => b.type === "table");
  assert.ok(tableBlock && tableBlock.type === "table");

  const brandRow = tableBlock.rows.find((r) => /brand/i.test(r[0] ?? ""));
  assert.ok(brandRow, "must have brand row from real DOCX bytes");
  assert.equal(brandRow![1], "L'Oréal Paris", "brand must not concatenate with Market");
  assert.ok(!brandRow![1]!.includes("ParisMarket"), "no ParisMarket concatenation");

  const marketRow = tableBlock.rows.find((r) => /^market$/i.test(r[0]?.trim() ?? ""));
  assert.ok(marketRow, "must have market row");
  assert.equal(marketRow![1], "Egypt");

  const llmText = serializeStructuredBrief(parsed.document);
  assert.ok(llmText.includes("L'Oréal Paris"), "LLM text includes brand from DOCX");
  assert.ok(!llmText.includes("ParisMarket"), "LLM text must not contain ParisMarket");

  const resolved = resolveBriefTextForExtraction({
    profile: createEmptyCampaignIntelligenceProfile(),
    document: {
      llm_brief_text: parsed.llmText,
      parsed_text: parsed.plainText,
    },
  });
  assert.equal(resolved.source, "llm_brief_text");
  assert.equal(resolved.text, parsed.llmText);

  console.log("loreal-docx.test.ts — passed", {
    bytes: buffer.length,
    tableRows: tableBlock.rows.length,
    llmTextLength: llmText.length,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
