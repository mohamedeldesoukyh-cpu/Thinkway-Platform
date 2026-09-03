/** Design suite sidebar — 62px rail / 252px expanded (sidebar.html §11). */
export const APP_SIDEBAR_WIDTH_EXPANDED = "252px";
export const APP_SIDEBAR_WIDTH_COLLAPSED = "62px";
export const APP_SIDEBAR_WIDTH_HIDDEN = "0px";
export const APP_SIDEBAR_MARGIN = "0px";
export const APP_SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

/** Hover leave delay before an unpinned peek collapses. */
export const APP_SIDEBAR_PEEK_CLOSE_DELAY_MS = 220;

/** Full sidebar panel vs icon rail — driven by pin (layout) or peek (overlay). */
export function resolveAppSidebarExpanded(pinnedOrPeek: boolean): boolean {
  return pinnedOrPeek;
}

/** Sidebar rail/edge is always present on desktop. */
export function resolveAppSidebarVisible(): boolean {
  return true;
}

/**
 * Layout width for main content offset.
 * Unpinned peek expands as an overlay — content stays on the rail width.
 */
export function getAppSidebarLayoutWidth(pinned: boolean): string {
  const base = pinned ? APP_SIDEBAR_WIDTH_EXPANDED : APP_SIDEBAR_WIDTH_COLLAPSED;
  return `calc(${base} + ${APP_SIDEBAR_MARGIN})`;
}

/** Half of the dashboard main column (viewport minus sidebar). */
export const APP_MAIN_HALF_PANEL_WIDTH = `calc((100vw - var(${APP_SIDEBAR_WIDTH_CSS_VAR}, ${APP_SIDEBAR_WIDTH_COLLAPSED})) / 2)`;
