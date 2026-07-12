"use client";

import { useEffect, type RefObject } from "react";

type UseAiComposerMetricsOptions = {
  /** Floating chat composer overlay at the bottom of the chat column. */
  composerRef: RefObject<HTMLElement | null>;
  /** Workspace root that owns CSS variables (`.ai-main-surface`). */
  rootRef: RefObject<HTMLElement | null>;
};

/**
 * Measure the rendered AI composer footer and publish `--ai-composer-measured-height`
 * so chat scroll padding clears the overlay without content bleeding through.
 */
export function useAiComposerMetrics({
  composerRef,
  rootRef,
}: UseAiComposerMetricsOptions): void {
  useEffect(() => {
    const composer = composerRef.current;
    const root = rootRef.current;
    if (!composer || !root) return;

    const sync = () => {
      const heightPx = composer.getBoundingClientRect().height;
      root.style.setProperty("--ai-composer-measured-height", `${heightPx}px`);
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

    resizeObserver?.observe(composer);

    window.addEventListener("resize", scheduleSync);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleSync);
      root.style.removeProperty("--ai-composer-measured-height");
    };
  }, [composerRef, rootRef]);
}
