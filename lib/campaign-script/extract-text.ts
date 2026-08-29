import "server-only";

import mammoth from "mammoth";

import { extractPdfText } from "@/lib/discovery-import/parsers/pdf-text";

import { CAMPAIGN_SCRIPT_FILE_MAX_BYTES } from "./types";

const TEXT_EXTENSIONS = new Set(["txt", "md", "rtf"]);
const DOCX_EXTENSIONS = new Set(["docx"]);
const PDF_EXTENSIONS = new Set(["pdf"]);

export const CAMPAIGN_SCRIPT_FILE_TOO_LARGE_MESSAGE =
  "That file is too large. Upload a script file under 8 MB.";

export function campaignScriptFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const dot = trimmed.lastIndexOf(".");
  if (dot < 0) return "";
  return trimmed.slice(dot + 1);
}

export function isSupportedCampaignScriptFile(fileName: string, mimeType?: string | null): boolean {
  const ext = campaignScriptFileExtension(fileName);
  if (TEXT_EXTENSIONS.has(ext) || DOCX_EXTENSIONS.has(ext) || PDF_EXTENSIONS.has(ext)) {
    return true;
  }
  const mime = (mimeType ?? "").toLowerCase();
  return (
    mime.startsWith("text/") ||
    mime === "application/pdf" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

export async function extractCampaignScriptText(input: {
  fileName: string;
  mimeType?: string | null;
  bytes: Buffer;
}): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  if (input.bytes.byteLength > CAMPAIGN_SCRIPT_FILE_MAX_BYTES) {
    return { ok: false, message: CAMPAIGN_SCRIPT_FILE_TOO_LARGE_MESSAGE };
  }
  if (!isSupportedCampaignScriptFile(input.fileName, input.mimeType)) {
    return {
      ok: false,
      message: "Upload a .txt, .md, .docx, or .pdf script file.",
    };
  }

  const ext = campaignScriptFileExtension(input.fileName);
  const mime = (input.mimeType ?? "").toLowerCase();
  try {
    if (PDF_EXTENSIONS.has(ext) || mime === "application/pdf") {
      const text = (await extractPdfText(input.bytes)).trim();
      if (!text) return { ok: false, message: "That PDF did not contain readable text." };
      return { ok: true, text };
    }
    if (
      DOCX_EXTENSIONS.has(ext) ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer: input.bytes });
      const text = (result.value ?? "").trim();
      if (!text) return { ok: false, message: "That Word file did not contain readable text." };
      return { ok: true, text };
    }
    const text = input.bytes.toString("utf8").replace(/^\uFEFF/, "").trim();
    if (!text) return { ok: false, message: "That file was empty." };
    return { ok: true, text };
  } catch {
    return { ok: false, message: "Could not read text from that file." };
  }
}
