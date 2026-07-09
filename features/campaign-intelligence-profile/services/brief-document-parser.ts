import {
  parseStructuredBriefDocument,
  type StructuredBriefParseResult,
} from "./structured-brief-parser";

export {
  parseStructuredBriefDocument,
  serializeStructuredBrief,
  structuredBriefToPlainText,
  parsePlainTextStructured,
  type StructuredBriefDocument,
  type StructuredBriefParseResult,
} from "./structured-brief-parser";

import { extractPdfText } from "@/lib/discovery-import/parsers/pdf-text";
import mammoth from "mammoth";
import JSZip from "jszip";

const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "pptx",
  "ppt",
  "txt",
  "md",
  "rtf",
]);

const SUPPORTED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/msword",
  "application/vnd.ms-word",
  "text/plain",
  "text/markdown",
  "text/rtf",
  "application/rtf",
]);

function stripXmlText(xml: string): string {
  const fromTags = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi);
  if (fromTags?.length) {
    return fromTags
      .map((tag) => tag.replace(/<[^>]+>/g, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return xml
    .replace(/<a:[^>]+>/g, " ")
    .replace(/<\/a:[^>]+>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractDocxTextLegacy(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value?.trim() ?? "";
    if (text.length >= 40) return text;
  } catch {
    // fall through
  }

  const zip = await JSZip.loadAsync(buffer);
  const xmlParts = Object.keys(zip.files)
    .filter((name) => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i.test(name))
    .sort();

  const chunks: string[] = [];
  for (const part of xmlParts) {
    const xml = await zip.file(part)?.async("string");
    if (xml) {
      const text = stripXmlText(xml);
      if (text) chunks.push(text);
    }
  }
  return chunks.join("\n\n");
}

export function isSupportedBriefMime(mime: string): boolean {
  return SUPPORTED_MIME.has(mime.trim().toLowerCase());
}

export function isSupportedBriefFile(file: File): boolean {
  if (file.type?.trim() && isSupportedBriefMime(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function resolveBriefMime(file: Pick<File, "name" | "type">): string {
  if (file.type?.trim()) return file.type.trim().toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    case "rtf":
      return "application/rtf";
    default:
      return file.type || "application/octet-stream";
  }
}

/** Structured parse — preferred path for LLM extraction. */
export async function extractStructuredBrief(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<StructuredBriefParseResult> {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "ppt") {
    throw new Error("Legacy .ppt files are not supported. Save as .pptx and try again.");
  }
  return parseStructuredBriefDocument(buffer, mimeType, fileName);
}

/** Legacy flat text extraction (storage preview fallback). */
export async function extractBriefDocumentText(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const structured = await extractStructuredBrief(buffer, mimeType, fileName);
  return structured.plainText;
}
