/**
 * Discovery platform design tokens — single source for class constants.
 * Golden reference: Discovery Search (`discovery-search-exact-*`, DiscoveryPageShell list variant).
 */

export {
  DISCOVERY_LIST_CARD_CLASS,
  DISCOVERY_TABLE_CELL_CLASS,
  DISCOVERY_TABLE_HEAD_CLASS,
  DISCOVERY_TABLE_ROW_CLASS,
  DiscoveryListCard,
} from "@/features/discovery/components/discovery-list-primitives";

/** List-variant page canvas (lavender scroll region). */
export const DISCOVERY_LIST_CANVAS_CLASS =
  "min-h-0 flex-1 space-y-4 overflow-y-auto bg-[var(--lavender)] px-4 pt-5 pb-[60px] dark:bg-background";

/** Embedded filter bar inside a list card. */
export const DISCOVERY_FILTER_BAR_CLASS =
  "flex flex-wrap items-center gap-2.5 border-b border-[var(--tw-border)] bg-background px-4 py-3.5";

/** Standalone filter bar (outside card). */
export const DISCOVERY_FILTER_BAR_STANDALONE_CLASS =
  "flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2";

/** Card section header strip (Import, list modules). */
export const DISCOVERY_SECTION_HEADER_CLASS =
  "border-b border-[var(--tw-border)] bg-muted/30 px-4 py-3.5";

/** Page header title — matches DiscoveryPageHeader. */
export const DISCOVERY_PAGE_TITLE_CLASS =
  "text-[18px] font-extrabold tracking-[-0.3px] text-[var(--text)] dark:text-foreground";

export const DISCOVERY_PAGE_DESC_CLASS = "mt-px text-xs text-[var(--text-3)]";

/** In-card section title. */
export const DISCOVERY_SECTION_TITLE_CLASS = "text-[12.5px] font-bold text-foreground";

export const DISCOVERY_SECTION_DESC_CLASS =
  "mt-0.5 max-w-2xl text-xs leading-relaxed text-[var(--text-3)]";

/** Exact-search toolbar row container. */
export const DISCOVERY_TOOLBAR_ROW_CLASS = "discovery-search-exact-toolbar";

/** Creator Details drawer max width (px) — keep in sync with `creator-detail-sheet.tsx`. */
export const CREATOR_DETAIL_SHEET_MAX_WIDTH_PX = 690;

/** Similar creators rail inside Creator Details (px). */
export const CREATOR_DETAIL_SHEET_SIMILAR_RAIL_WIDTH_PX = 210;

/** Discovery filter drawer = Creator Details width − 30%. */
export const DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX = Math.round(
  CREATOR_DETAIL_SHEET_MAX_WIDTH_PX * 0.7
);

/** Add creators picker panel — compact cards matching shortlist creator rows. */
export const CREATOR_PICKER_SHEET_MAX_WIDTH_PX = 440;
