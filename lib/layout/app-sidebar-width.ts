/** Design suite sidebar — 252px expanded; unpinned = auto-hide tip (no icon rail). */
export const APP_SIDEBAR_WIDTH_EXPANDED = "252px";
/** Layout reservation when unpinned — panel is overlay; tip is fixed on the edge. */
export const APP_SIDEBAR_WIDTH_COLLAPSED = "0px";
export const APP_SIDEBAR_WIDTH_HIDDEN = "0px";
/** Hit / tip strip on the left edge when navigation is tucked away. */
export const APP_SIDEBAR_TIP_WIDTH = "12px";
export const APP_SIDEBAR_MARGIN = "0px";
export const APP_SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

/** Hover leave delay before an unpinned peek collapses. */
export const APP_SIDEBAR_PEEK_CLOSE_DELAY_MS = 220;

/** Full sidebar panel vs hidden — driven by pin (layout) or peek (overlay). */
export function resolveAppSidebarExpanded(pinnedOrPeek: boolean): boolean {
  return pinnedOrPeek;
}

/** Sidebar rail/edge is always present on desktop. */
export function resolveAppSidebarVisible(): boolean {
  return true;
}

/**
 * Layout width for main content offset.
 * Unpinned peek expands as an overlay — content uses full width (0 reserved).
 */
export function getAppSidebarLayoutWidth(pinned: boolean): string {
  const base = pinned ? APP_SIDEBAR_WIDTH_EXPANDED : APP_SIDEBAR_WIDTH_COLLAPSED;
  return `calc(${base} + ${APP_SIDEBAR_MARGIN})`;
}

/** Half of the dashboard main column (viewport minus sidebar). */
export const APP_MAIN_HALF_PANEL_WIDTH = `calc((100vw - var(${APP_SIDEBAR_WIDTH_CSS_VAR}, ${APP_SIDEBAR_WIDTH_COLLAPSED})) / 2)`;
