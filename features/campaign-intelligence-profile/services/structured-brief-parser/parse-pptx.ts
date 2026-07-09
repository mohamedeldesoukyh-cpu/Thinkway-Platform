import JSZip from "jszip";

import { parsePlainTextStructured } from "./parse-text";
import type { StructuredBriefDocument } from "./types";

function stripXmlText(xml: string): string {
  const fromTags = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/gi);
  if (fromTags?.length) {
    return fromTags
      .map((tag) => tag.replace(/<[^>]+>/g, ""))
      .join("\n")
      .replace(/\s+/g, " ")
      .trim();
  }
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parsePptxStructured(buffer: Buffer): Promise<StructuredBriefDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const parts = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort();

  const slideTexts: string[] = [];
  for (const part of parts) {
    const xml = await zip.file(part)?.async("string");
    if (xml) {
      const text = stripXmlText(xml);
      if (text) slideTexts.push(text);
    }
  }

  const combined = slideTexts.join("\n\n");
  return parsePlainTextStructured(combined, "pptx", "pptx_xml");
}
