import JSZip from "jszip";
import mammoth from "mammoth";

import type { StructuredBriefBlock, StructuredBriefDocument, StructuredBriefSection } from "./types";

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/** Extract text from a w:tc cell without merging adjacent cells. */
function extractCellText(cellXml: string): string {
  const parts = cellXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi);
  if (!parts?.length) return "";
  return decodeXmlEntities(
    parts.map((tag) => tag.replace(/<[^>]+>/g, "")).join(" ").replace(/\s+/g, " ").trim()
  );
}

function extractTableRows(tableXml: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = tableXml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/gi) ?? [];
  for (const rowXml of rowMatches) {
    const cells = rowXml.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/gi) ?? [];
    const row = cells.map(extractCellText).filter((c) => c.length > 0 || cells.length <= 2);
    if (row.some((c) => c.trim())) rows.push(row);
  }
  return rows;
}

function isHeadingStyle(styleVal: string | null): number | null {
  if (!styleVal) return null;
  const match = styleVal.match(/Heading(\d)/i);
  if (match) return Number(match[1]);
  if (/title/i.test(styleVal)) return 1;
  return null;
}

function parseDocumentXml(xml: string): StructuredBriefSection[] {
  const sections: StructuredBriefSection[] = [];
  let current: StructuredBriefSection = { blocks: [] };

  const bodyMatch = xml.match(/<w:body[^>]*>([\s\S]*)<\/w:body>/i);
  if (!bodyMatch) return sections;

  const body = bodyMatch[1]!;
  const elements = body.match(/<w:(p|tbl)[\s>][\s\S]*?<\/w:\1>/gi) ?? [];

  for (const element of elements) {
    if (element.startsWith("<w:tbl")) {
      const rows = extractTableRows(element);
      if (rows.length > 0) {
        current.blocks.push({ type: "table", rows });
      }
      continue;
    }

    const styleMatch = element.match(/<w:pStyle w:val="([^"]+)"/i);
    const headingLevel = isHeadingStyle(styleMatch?.[1] ?? null);
    const textParts = element.match(/<w:t[^>]*>([^<]*)<\/w:t>/gi);
    const text = textParts
      ? decodeXmlEntities(
          textParts.map((t) => t.replace(/<[^>]+>/g, "")).join(" ").replace(/\s+/g, " ").trim()
        )
      : "";

    if (!text) continue;

    if (headingLevel != null) {
      if (current.blocks.length > 0 || current.title) {
        sections.push(current);
        current = { blocks: [] };
      }
      current.title = text;
      current.blocks.push({ type: "heading", level: headingLevel, text });
      continue;
    }

    const numMatch = element.match(/<w:numPr>/i);
    if (numMatch) {
      const last = current.blocks[current.blocks.length - 1];
      if (last?.type === "list") {
        last.items.push(text);
      } else {
        current.blocks.push({ type: "list", ordered: false, items: [text] });
      }
      continue;
    }

    current.blocks.push({ type: "paragraph", text });
  }

  if (current.blocks.length > 0 || current.title) {
    sections.push(current);
  }

  return sections;
}

/** Split flattened label:value lines (mammoth failure mode) into table rows. */
function repairFlattenedKeyValue(text: string): StructuredBriefBlock[] {
  const blocks: StructuredBriefBlock[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const kvRows: string[][] = [];
  for (const line of lines) {
    const match = line.match(/^(.+?)\s*[:：]\s*(.+)$/);
    if (match) {
      kvRows.push([match[1]!.trim(), match[2]!.trim()]);
    } else if (kvRows.length > 0) {
      blocks.push({ type: "table", rows: kvRows.splice(0) });
      blocks.push({ type: "paragraph", text: line });
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }
  if (kvRows.length > 0) {
    blocks.push({ type: "table", rows: kvRows });
  }
  return blocks;
}

async function parseDocxFromXml(buffer: Buffer): Promise<StructuredBriefDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file("word/document.xml")?.async("string");
  if (!docXml) {
    return { sections: [], sourceFormat: "docx" };
  }

  const sections = parseDocumentXml(docXml);
  const title = sections[0]?.title ?? sections[0]?.blocks.find((b) => b.type === "heading")?.text;

  return {
    title: title?.trim(),
    sections: sections.length > 0 ? sections : [{ blocks: [] }],
    sourceFormat: "docx",
  };
}

async function parseDocxFromMammothHtml(buffer: Buffer): Promise<StructuredBriefSection[]> {
  try {
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value ?? "";
    if (!html.trim()) return [];

    const sections: StructuredBriefSection[] = [];
    let current: StructuredBriefSection = { blocks: [] };

    const blockRegex = /<(h[1-6]|p|table|ul|ol)[^>]*>([\s\S]*?)<\/\1>/gi;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(html)) !== null) {
      const tag = match[1]!.toLowerCase();
      const inner = match[2]!;

      if (tag.startsWith("h")) {
        const text = inner.replace(/<[^>]+>/g, "").trim();
        if (text) {
          if (current.blocks.length > 0 || current.title) {
            sections.push(current);
            current = { blocks: [] };
          }
          current.title = text;
          current.blocks.push({ type: "heading", level: Number(tag[1]), text });
        }
      } else if (tag === "p") {
        const text = inner.replace(/<[^>]+>/g, "").trim();
        if (text) current.blocks.push({ type: "paragraph", text });
      } else if (tag === "table") {
        const rows: string[][] = [];
        const rowMatches = inner.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];
        for (const rowHtml of rowMatches) {
          const cells = rowHtml.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi) ?? [];
          const row = cells.map((c) => c.replace(/<[^>]+>/g, "").trim());
          if (row.some(Boolean)) rows.push(row);
        }
        if (rows.length > 0) current.blocks.push({ type: "table", rows });
      } else if (tag === "ul" || tag === "ol") {
        const items = (inner.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) ?? []).map((li) =>
          li.replace(/<[^>]+>/g, "").trim()
        ).filter(Boolean);
        if (items.length > 0) {
          current.blocks.push({ type: "list", ordered: tag === "ol", items });
        }
      }
    }

    if (current.blocks.length > 0 || current.title) sections.push(current);
    return sections;
  } catch {
    return [];
  }
}

export async function parseDocxStructured(buffer: Buffer): Promise<StructuredBriefDocument> {
  const fromXml = await parseDocxFromXml(buffer);
  const hasTables = fromXml.sections.some((s) => s.blocks.some((b) => b.type === "table"));
  if (hasTables && fromXml.sections.some((s) => s.blocks.length > 0)) {
    return { ...fromXml, parserMode: "docx_ooxml_tables" };
  }

  const fromHtml = await parseDocxFromMammothHtml(buffer);
  if (fromHtml.some((s) => s.blocks.length > 0)) {
    return {
      title: fromHtml[0]?.title,
      sections: fromHtml,
      sourceFormat: "docx",
      parserMode: "docx_mammoth_html",
    };
  }

  try {
    const raw = await mammoth.extractRawText({ buffer });
    const text = raw.value?.trim() ?? "";
    if (text) {
      return {
        sections: [{ blocks: repairFlattenedKeyValue(text) }],
        sourceFormat: "docx",
        parserMode: "docx_mammoth_raw_repair",
      };
    }
  } catch {
    // fall through
  }

  return { ...fromXml, parserMode: "docx_ooxml_empty" };
}
