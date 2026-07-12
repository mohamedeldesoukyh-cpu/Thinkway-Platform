"use client";

import { useEffect, type RefObject } from "react";

type UseAiTopbarMetricsOptions = {
  /** Floating Thinkway Intelligence header (absolute overlay). */
  topbarRef: RefObject<HTMLElement | null>;
  /** Workspace root that owns CSS variables (`.ai-main-surface`). */
  rootRef: RefObject<HTMLElement | null>;
  /** Chat scroll container — sticky chrome is positioned relative to this element. */
  scrollContainer?: HTMLElement | null;
};

/**
 * Measure the rendered AI topbar and publish CSS variables for Campaign Studio
 * sticky chrome so it sits flush on the bottom edge of the intelligence header.
 */
export function useAiTopbarMetrics({
  topbarRef,
  rootRef,
  scrollContainer = null,
}: UseAiTopbarMetricsOptions): void {
  useEffect(() => {
    const topbar = topbarRef.current;
    const root = rootRef.current;
    if (!topbar || !root) return;

    const sync = () => {
      const topbarRect = topbar.getBoundingClientRect();
      const heightPx = topbarRect.height;

      root.style.setProperty("--ai-topbar-measured-height", `${heightPx}px`);

      if (scrollContainer) {
        const scrollRect = scrollContainer.getBoundingClientRect();
        const stickyTopPx = Math.max(0, topbarRect.bottom - scrollRect.top);
        root.style.setProperty("--studio-sticky-top-measured", `${stickyTopPx}px`);
        scrollContainer.style.setProperty("--studio-sticky-top", `${stickyTopPx}px`);
      } else {
        root.style.setProperty("--studio-sticky-top-measured", `${heightPx}px`);
      }
    };

    let rafId = 0;
    const scheduleSync = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        sync();
      });
    };

    sync();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleSync) : null;

    resizeObserver?.observe(topbar);

    if (scrollContainer) {
      resizeObserver?.observe(scrollContainer);
      scrollContainer.addEventListener("scroll", scheduleSync, { passive: true });
    }

    window.addEventListener("resize", scheduleSync);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleSync);
      scrollContainer?.removeEventListener("scroll", scheduleSync);
      root.style.removeProperty("--ai-topbar-measured-height");
      root.style.removeProperty("--studio-sticky-top-measured");
      scrollContainer?.style.removeProperty("--studio-sticky-top");
    };
  }, [topbarRef, rootRef, scrollContainer]);
}
