type OutsideDismissOptions = {
  /** When true, clicking creator list rows does not dismiss the sheet (Discovery row-switch UX). */
  preserveOnCreatorRows?: boolean;
};

/** Keep creator detail open when interacting with stacked dialogs/menus behind the sheet. */
export function shouldPreventCreatorDetailSheetOutsideDismiss(
  target: EventTarget | null,
  options: OutsideDismissOptions = {}
): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;

  const preserveOnCreatorRows = options.preserveOnCreatorRows ?? true;

  if (preserveOnCreatorRows) {
    if (
      target.closest("[data-discovery-creator-target]") ||
      target.closest("[data-creator-detail-target]") ||
      target.closest(".discovery-search-exact-row")
    ) {
      return true;
    }
  }

  return Boolean(
    target.closest('[data-slot="dialog"]') ||
      target.closest('[data-slot="dialog-content"]') ||
      target.closest('[data-slot="dialog-overlay"]') ||
      target.closest('[data-slot="dialog-portal"]') ||
      target.closest('[role="dialog"]') ||
      target.closest('[data-slot="dropdown-menu-content"]') ||
      target.closest('[data-slot="dropdown-menu-trigger"]') ||
      target.closest('[role="menu"]') ||
      target.closest('[data-radix-popper-content-wrapper]')
  );
}
