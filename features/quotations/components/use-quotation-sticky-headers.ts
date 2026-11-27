
import { useLayoutEffect, useRef } from "react";

/** Scroll the title/navigation away while pinning financial figures and actions. */
export function useQuotationStickyHeaders() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const header = root.querySelector<HTMLElement>(".q-frozen-summary");
    const financials = header?.querySelector<HTMLElement>(".q-fin");
    const navigator = root.querySelector<HTMLElement>(".media-quotation-navigation");
    const tools = root.querySelector<HTMLElement>(".q-lines__h");
    if (!header) return;
    const measure = () => {
      const headerHeight = header.offsetHeight;
      const toolsHeight = tools?.offsetHeight ?? 0;
      const availableHeight = Math.min(root.clientHeight, window.innerHeight - Math.max(0, root.getBoundingClientRect().top));
      const titleHeight = financials ? financials.getBoundingClientRect().top - header.getBoundingClientRect().top : 0;
      // Pin from the financial band, not the title. On short screens leave
      // sufficient room for rows while keeping every control reachable above.
      const top = Math.max(-headerHeight, Math.min(-titleHeight, availableHeight - headerHeight - toolsHeight - 240));
      root.style.setProperty("--q-summary-top", `${top}px`);
      root.style.setProperty("--q-summary-visible", `${headerHeight + top + (navigator?.offsetHeight ?? 0)}px`);
      root.style.setProperty("--q-lines-tools-height", `${toolsHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(header);
    if (tools) observer.observe(tools);
    if (navigator) observer.observe(navigator);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  });
  return ref;
}
