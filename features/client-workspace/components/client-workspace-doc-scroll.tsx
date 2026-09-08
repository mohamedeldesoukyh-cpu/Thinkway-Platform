"use client";

import { useEffect } from "react";

/**
 * Marks html[data-tw-cw] so mobile Client Review CSS can unlock the root
 * body / app-shell overflow chain (see client-review-ref.css ≤980px).
 */
export function ClientWorkspaceDocScroll() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-tw-cw", "1");
    return () => {
      root.removeAttribute("data-tw-cw");
    };
  }, []);

  return null;
}
