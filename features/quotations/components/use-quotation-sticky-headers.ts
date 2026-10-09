"use client";

import { useLayoutEffect, useRef } from "react";

/** Measure wrapping/translated headers instead of assuming a desktop height. */
export function useQuotationStickyHeaders() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const header = root.querySelector<HTMLElement>(".q-frozen-summary");
    const tools = root.querySelector<HTMLElement>(".q-lines__h");
    if (!header) return;
    const measure = () => {
      const headerHeight = header.offsetHeight;
      const toolsHeight = tools?.offsetHeight ?? 0;
      // On short/mobile viewports let the upper summary scroll out, leaving
      // room to work with rows. Every summary control remains reachable above.
      const top = Math.max(-headerHeight, Math.min(0, root.clientHeight - headerHeight - toolsHeight - 240));
      root.style.setProperty("--q-summary-top", `${top}px`);
      root.style.setProperty("--q-summary-visible", `${headerHeight + top}px`);
      root.style.setProperty("--q-lines-tools-height", `${toolsHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(header);
    if (tools) observer.observe(tools);
    measure();
    return () => observer.disconnect();
  });
  return ref;
}
