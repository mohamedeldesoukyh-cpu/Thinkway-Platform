/** Radix dropdown dismiss can fire pointer-outside on a sheet opened from a menu item. */
export function schedulePublicationWorkspaceOpen(
  publicationId: string,
  open: (id: string) => void
): void {
  if (typeof window === "undefined") {
    open(publicationId);
    return;
  }
  window.requestAnimationFrame(() => {
    open(publicationId);
  });
}

export function shouldPreventSheetOutsideDismiss(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return Boolean(
    target.closest('[data-slot="dropdown-menu-content"]') ||
      target.closest('[data-slot="dropdown-menu-trigger"]') ||
      target.closest('[role="menu"]') ||
      target.closest('[data-radix-popper-content-wrapper]')
  );
}
