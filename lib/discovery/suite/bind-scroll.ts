/**
 * Pack bindScroll() — single-listener guard (00-FOUNDATION.md §0.12).
 * Call from draw()/effect; safe to invoke many times.
 */

type ScrollTarget = Pick<Window, "addEventListener" | "scrollY"> & {
  removeEventListener?: Window["removeEventListener"];
};

export function createBindScrollGuard(win: ScrollTarget = typeof window !== "undefined" ? window : (null as unknown as ScrollTarget)) {
  let bound = false;
  return function bindScroll(onScroll: (scrollY: number) => void): void {
    if (bound || !win) return;
    bound = true;
    const handler = () => onScroll(win.scrollY);
    win.addEventListener("scroll", handler, { passive: true } as AddEventListenerOptions);
    handler();
  };
}

/** Module singleton for browser pages. */
let pageBind: ReturnType<typeof createBindScrollGuard> | null = null;

export function bindScroll(onScroll: (scrollY: number) => void): void {
  if (typeof window === "undefined") return;
  if (!pageBind) pageBind = createBindScrollGuard(window);
  pageBind(onScroll);
}
