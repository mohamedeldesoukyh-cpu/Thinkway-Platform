/**
 * Public section surface — prefer SectionRenderer (code-split).
 * Do not re-export individual sections here; that would undo chunking.
 */
export {
  SectionRenderer,
  isFullWidthSection,
  getSectionLayout,
  STUDIO_LAYOUT,
} from "./section-renderer";
