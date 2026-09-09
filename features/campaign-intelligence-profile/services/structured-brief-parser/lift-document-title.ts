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
 * no content of its own. A first section with real blocks keeps its title and
 * stays; genuinely repeated text elsewhere in the document is never touched,
 * because nothing here compares strings across the document.
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

  // Otherwise the first section is real content — name the document after it
  // without removing anything.
  return { title: firstTitle || undefined, sections };
}
