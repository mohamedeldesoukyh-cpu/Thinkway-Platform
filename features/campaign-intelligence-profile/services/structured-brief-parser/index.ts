import { extractPdfText } from "@/lib/discovery-import/parsers/pdf-text";

import { parseDocxStructured } from "./parse-docx";
import { parsePptxStructured } from "./parse-pptx";
import { parsePlainTextStructured } from "./parse-text";
import { serializeStructuredBrief, structuredBriefToPlainText } from "./serialize";
import type { StructuredBriefDocument, StructuredBriefParseResult } from "./types";

export type { StructuredBriefBlock, StructuredBriefDocument, StructuredBriefParseResult } from "./types";
export { serializeStructuredBrief, structuredBriefToPlainText } from "./serialize";
export { parsePlainTextStructured } from "./parse-text";

function extractRtfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  return raw
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse a brief document into structured blocks + LLM-friendly text. */
export async function parseStructuredBriefDocument(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<StructuredBriefParseResult> {
  const mime = mimeType.trim().toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  let document: StructuredBriefDocument;

  if (mime === "application/pdf" || ext === "pdf") {
    const text = (await extractPdfText(buffer)).trim();
    document = parsePlainTextStructured(text, "pdf", "pdf_text");
  } else if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    document = await parseDocxStructured(buffer);
  } else if (mime === "application/msword" || ext === "doc") {
    const text = buffer.toString("utf8").trim() || extractRtfText(buffer);
    document = parsePlainTextStructured(text, "doc");
  } else if (
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ext === "pptx"
  ) {
    document = await parsePptxStructured(buffer);
  } else if (mime === "text/plain" || mime === "text/markdown" || ext === "txt" || ext === "md") {
    document = parsePlainTextStructured(buffer.toString("utf8").trim(), "txt");
  } else if (mime === "text/rtf" || mime === "application/rtf" || ext === "rtf") {
    document = parsePlainTextStructured(extractRtfText(buffer), "rtf");
  } else {
    throw new Error(`Unsupported brief format: ${mimeType || ext}`);
  }

  const llmText = serializeStructuredBrief(document);
  const plainText = structuredBriefToPlainText(document);

  return {
    document,
    llmText: llmText || plainText,
    plainText: plainText || llmText,
  };
}
