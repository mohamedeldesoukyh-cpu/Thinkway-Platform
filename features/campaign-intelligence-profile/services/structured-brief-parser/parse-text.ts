import type { StructuredBriefBlock, StructuredBriefDocument, StructuredBriefSection } from "./types";

const SECTION_HEADING_PATTERN = /^(section|campaign information|overview|requirements|deliverables)\b/i;
const KV_LINE_PATTERN = /^(.{2,60}?)\s*[:：]\s*(.+)$/;

function parseLinesToBlocks(lines: string[]): StructuredBriefBlock[] {
  const blocks: StructuredBriefBlock[] = [];
  const kvBuffer: string[][] = [];

  function flushKv() {
    if (kvBuffer.length > 0) {
      blocks.push({ type: "table", rows: kvBuffer.splice(0) });
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushKv();
      continue;
    }

    const kvMatch = line.match(KV_LINE_PATTERN);
    if (kvMatch && !SECTION_HEADING_PATTERN.test(kvMatch[1]!)) {
      kvBuffer.push([kvMatch[1]!.trim(), kvMatch[2]!.trim()]);
      continue;
    }

    flushKv();

    if (SECTION_HEADING_PATTERN.test(line) || /^[A-Z][\w\s/&'-]{2,40}$/.test(line)) {
      blocks.push({ type: "heading", level: 2, text: line });
      continue;
    }

    if (/^[-•*]\s+/.test(line)) {
      const item = line.replace(/^[-•*]\s+/, "").trim();
      const last = blocks[blocks.length - 1];
      if (last?.type === "list" && !last.ordered) {
        last.items.push(item);
      } else {
        blocks.push({ type: "list", ordered: false, items: [item] });
      }
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const item = line.replace(/^\d+[.)]\s+/, "").trim();
      const last = blocks[blocks.length - 1];
      if (last?.type === "list" && last.ordered) {
        last.items.push(item);
      } else {
        blocks.push({ type: "list", ordered: true, items: [item] });
      }
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
  }

  flushKv();
  return blocks;
}

function groupBlocksIntoSections(blocks: StructuredBriefBlock[]): StructuredBriefSection[] {
  const sections: StructuredBriefSection[] = [];
  let current: StructuredBriefSection = { blocks: [] };

  for (const block of blocks) {
    if (block.type === "heading" && block.level <= 2) {
      if (current.blocks.length > 0 || current.title) {
        sections.push(current);
        current = { blocks: [] };
      }
      current.title = block.text;
      current.blocks.push(block);
      continue;
    }
    current.blocks.push(block);
  }

  if (current.blocks.length > 0 || current.title) {
    sections.push(current);
  }

  return sections.length > 0 ? sections : [{ blocks }];
}

/** Best-effort structure from plain text (PDF, TXT, PPTX slide text). */
export function parsePlainTextStructured(
  text: string,
  sourceFormat: StructuredBriefDocument["sourceFormat"] = "txt",
  parserMode: StructuredBriefDocument["parserMode"] = "plain_text"
): StructuredBriefDocument {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const blocks = parseLinesToBlocks(lines);
  const sections = groupBlocksIntoSections(blocks);
  const title =
    sections[0]?.title ??
    (sections[0]?.blocks.find((b) => b.type === "heading") as { text: string } | undefined)?.text;

  return {
    title: title?.trim(),
    sections,
    sourceFormat,
    parserMode,
  };
}
