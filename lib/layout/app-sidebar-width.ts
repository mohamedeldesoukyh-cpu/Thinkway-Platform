/** Matches `--rail: 266px` in Thinkway_Client_Form final.html. */
export const APP_SIDEBAR_WIDTH_EXPANDED = "16.625rem";
export const APP_SIDEBAR_WIDTH_COLLAPSED = "4rem";
export const APP_SIDEBAR_WIDTH_HIDDEN = "0px";
export const APP_SIDEBAR_MARGIN = "0px";
export const APP_SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

/** Full sidebar panel vs icon rail — driven only by user collapse preference. */
export function resolveAppSidebarExpanded(userExpanded: boolean): boolean {
  return userExpanded;
}

/** Sidebar is always visible on desktop (no auto-hide). */
export function resolveAppSidebarVisible(): boolean {
  return true;
}

/** Layout width for main content offset. */
export function getAppSidebarLayoutWidth(displayExpanded: boolean): string {
  const base = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;
  return `calc(${base} + ${APP_SIDEBAR_MARGIN})`;
}

/** Half of the dashboard main column (viewport minus sidebar). */
export const APP_MAIN_HALF_PANEL_WIDTH = `calc((100vw - var(${APP_SIDEBAR_WIDTH_CSS_VAR}, ${APP_SIDEBAR_WIDTH_COLLAPSED})) / 2)`;
