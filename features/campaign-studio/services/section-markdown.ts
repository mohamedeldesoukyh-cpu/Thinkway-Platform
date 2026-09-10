/**
 * The light markdown the section formatters actually emit.
 *
 * Every studio section that has no structured data yet falls back to its
 * formatter's text, and `SectionFallbackContent` printed that text verbatim —
 * so the Content screen showed `**Duration:** 4 weeks` and `**Week 1** —
 * Campaign Start` with the asterisks in front of the operator. The formatters
 * (`section-formatters`, `strategy-document`) only ever produce bold spans,
 * `_emphasis_`, `#` headings and `-` / `·` bullets, so parsing exactly that is
 * enough — no markdown library, and no change to the content itself.
 */

export type SectionMarkdownSpan = { text: string; bold?: boolean; italic?: boolean };

export type SectionMarkdownLine =
  | { kind: "heading"; level: number; spans: SectionMarkdownSpan[] }
  | { kind: "bullet"; depth: number; spans: SectionMarkdownSpan[] }
  | { kind: "text"; spans: SectionMarkdownSpan[] };

export type SectionMarkdownBlock = { lines: SectionMarkdownLine[] };

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g;

/** Split one line into plain / bold / italic spans. */
export function parseSectionMarkdownSpans(line: string): SectionMarkdownSpan[] {
  const spans: SectionMarkdownSpan[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      spans.push({ text: line.slice(lastIndex, start) });
    }
    if (token.startsWith("**") || token.startsWith("__")) {
      spans.push({ text: token.slice(2, -2), bold: true });
    } else {
      spans.push({ text: token.slice(1, -1), italic: true });
    }
    lastIndex = start + token.length;
  }
  if (lastIndex < line.length) {
    spans.push({ text: line.slice(lastIndex) });
  }
  // An empty result means the line was entirely markers; keep the raw text
  // rather than rendering nothing.
  return spans.length > 0 ? spans : [{ text: line }];
}

/** A bullet line, and how deep it is indented. */
function bulletOf(raw: string): { depth: number; content: string } | null {
  const match = raw.match(/^(\s*)(?:[-*•]|·)\s+(.*)$/);
  if (!match) return null;
  return { depth: Math.floor((match[1]?.length ?? 0) / 2), content: match[2] ?? "" };
}

/**
 * Parse formatter text into paragraphs of lines.
 *
 * Blank lines separate blocks, matching the paragraph split the fallback
 * renderer already used, so spacing is unchanged.
 */
export function parseSectionMarkdown(text: string): SectionMarkdownBlock[] {
  const blocks: SectionMarkdownBlock[] = [];
  let current: SectionMarkdownLine[] = [];

  const flush = () => {
    if (current.length > 0) blocks.push({ lines: current });
    current = [];
  };

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) {
      flush();
      continue;
    }

    const heading = raw.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      current.push({
        kind: "heading",
        level: heading[1]!.length,
        spans: parseSectionMarkdownSpans(heading[2] ?? ""),
      });
      continue;
    }

    const bullet = bulletOf(raw);
    if (bullet) {
      current.push({
        kind: "bullet",
        depth: bullet.depth,
        spans: parseSectionMarkdownSpans(bullet.content),
      });
      continue;
    }

    current.push({ kind: "text", spans: parseSectionMarkdownSpans(raw.trim()) });
  }

  flush();
  return blocks;
}

/** True when the text carries formatting the plain renderer would leak. */
export function hasSectionMarkdown(text: string): boolean {
  return /\*\*[^*]+\*\*|__[^_]+__|^#{1,6}\s|^\s*[-*•·]\s/m.test(text);
}
