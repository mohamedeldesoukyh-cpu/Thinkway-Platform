/** Matches `w-64` / `w-14` on CollapsibleAppSidebar. */
export const APP_SIDEBAR_WIDTH_EXPANDED = "16rem";
export const APP_SIDEBAR_WIDTH_COLLAPSED = "3.5rem";
export const APP_SIDEBAR_WIDTH_CSS_VAR = "--app-sidebar-width";

/** Half of the dashboard main column (viewport minus sidebar). */
export const APP_MAIN_HALF_PANEL_WIDTH = `calc((100vw - var(${APP_SIDEBAR_WIDTH_CSS_VAR}, ${APP_SIDEBAR_WIDTH_COLLAPSED})) / 2)`;
