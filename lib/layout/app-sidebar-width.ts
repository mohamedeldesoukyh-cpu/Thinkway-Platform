/** Matches `--rail: 266px` in Thinkway_Client_Form final.html. */
export const APP_SIDEBAR_WIDTH_EXPANDED = "16.625rem";
export const APP_SIDEBAR_WIDTH_COLLAPSED = "3.5rem";
export const APP_SIDEBAR_WIDTH_HIDDEN = "0px";
export const APP_SIDEBAR_MARGIN = "0.875rem";
export const APP_SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

/** Hover-reveal always uses full width; collapsed mode only when pinned. */
export function resolveAppSidebarExpanded(
  isVisible: boolean,
  pinned: boolean,
  userExpanded: boolean
): boolean {
  if (!isVisible) return userExpanded;
  return pinned ? userExpanded : true;
}

/** Layout width for main content offset. Hidden = 0; visible uses expanded or collapsed rail. */
export function getAppSidebarLayoutWidth(
  isVisible: boolean,
  displayExpanded: boolean
): string {
  if (!isVisible) return APP_SIDEBAR_WIDTH_HIDDEN;
  const base = displayExpanded
    ? APP_SIDEBAR_WIDTH_EXPANDED
    : APP_SIDEBAR_WIDTH_COLLAPSED;
  return `calc(${base} + ${APP_SIDEBAR_MARGIN})`;
}

/** Half of the dashboard main column (viewport minus sidebar). */
export const APP_MAIN_HALF_PANEL_WIDTH = `calc((100vw - var(${APP_SIDEBAR_WIDTH_CSS_VAR}, ${APP_SIDEBAR_WIDTH_COLLAPSED})) / 2)`;
