import type { StructuredBriefSection } from "./types";

/**
 * Lift a leading title-only section up to the document title.
 *
 * A document whose first line is a heading produces a section carrying just
 * that heading. Left in place it is emitted twice — once as `document.title`
 * and again as `Section: <title>` — so the same words appeared three times
 * alongside the heading block.
 *
 * The section is removed only when it is exactly the document title and holds
 * no content of its own, and `document.title` is set only in that case — so the
 * title string is owned by exactly one representation and cannot be emitted
 * twice. A first section with real blocks keeps its title and stays, and the
 * document is then left unnamed rather than repeating that heading.
 *
 * Genuinely repeated text elsewhere in the document is never touched: this
 * reasons about the section that produced the title, never about matching
 * strings across the document.
 */
export function liftDocumentTitle(sections: StructuredBriefSection[]): {
  title?: string;
  sections: StructuredBriefSection[];
} {
  const first = sections[0];
  const firstTitle = first?.title?.trim();

  if (first && firstTitle && first.blocks.length === 0) {
    return { title: firstTitle, sections: sections.slice(1) };
  }

  // The first section is real content, so it keeps its title and stays. Naming
  // the document after it as well would emit the same words twice — once as
  // `document.title`, once as that section's heading.
  return { sections };
}
