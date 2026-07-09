import type {
  StructuredBriefBlock,
  StructuredBriefDocument,
  StructuredBriefSection,
} from "./types";

function serializeTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  const isKeyValue =
    rows.every((row) => row.length >= 2) &&
    rows.every((row) => row[0]?.trim() && row.slice(1).some((c) => c?.trim()));

  if (isKeyValue && rows.every((row) => row.length === 2)) {
    return rows
      .map(([key, value]) => `${key.trim()} -> ${value.trim()}`)
      .join("\n");
  }

  return rows
    .map((row) => row.map((cell) => cell.trim()).filter(Boolean).join(" | "))
    .join("\n");
}

function serializeBlock(block: StructuredBriefBlock): string {
  switch (block.type) {
    case "heading":
      return block.text.trim();
    case "paragraph":
      return block.text.trim();
    case "list":
      return block.items.map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`)).join("\n");
    case "table":
      return `Table:\n${serializeTable(block.rows)}`;
    default:
      return "";
  }
}

function serializeSection(section: StructuredBriefSection): string {
  const lines: string[] = [];
  if (section.title?.trim()) {
    lines.push(`Section: ${section.title.trim()}`);
  }
  for (const block of section.blocks) {
    const text = serializeBlock(block);
    if (text) lines.push(text);
  }
  return lines.join("\n");
}

/** Serialize structured document to LLM-friendly format preserving tables and sections. */
export function serializeStructuredBrief(document: StructuredBriefDocument): string {
  const parts: string[] = [];
  if (document.title?.trim()) {
    parts.push(document.title.trim());
  }
  for (const section of document.sections) {
    const text = serializeSection(section);
    if (text) parts.push(text);
  }
  return parts.join("\n\n").trim();
}

/** Flat plain text for storage preview (no structure markers). */
export function structuredBriefToPlainText(document: StructuredBriefDocument): string {
  const parts: string[] = [];
  if (document.title?.trim()) parts.push(document.title.trim());
  for (const section of document.sections) {
    if (section.title?.trim()) parts.push(section.title.trim());
    for (const block of section.blocks) {
      switch (block.type) {
        case "heading":
        case "paragraph":
          if (block.text.trim()) parts.push(block.text.trim());
          break;
        case "list":
          parts.push(...block.items.filter(Boolean));
          break;
        case "table":
          for (const row of block.rows) {
            const cells = row.map((c) => c.trim()).filter(Boolean);
            if (cells.length >= 2) {
              parts.push(`${cells[0]}: ${cells.slice(1).join(", ")}`);
            } else if (cells.length === 1) {
              parts.push(cells[0]!);
            }
          }
          break;
        default:
          break;
      }
    }
  }
  return parts.join("\n").trim();
}
