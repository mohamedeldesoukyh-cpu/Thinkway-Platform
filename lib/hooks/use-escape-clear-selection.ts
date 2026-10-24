"use client";
import { useEffect } from "react";
import { isShortcutVisible } from "@/lib/productivity/shortcut-targets";
/** Dialogs and menus consume Escape before the page's selection does. */
export function useEscapeClearSelection(hasSelection: boolean, clear: () => void) {
  useEffect(() => {
    if (!hasSelection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"][data-state="open"]')) return;
      if (Array.from(document.querySelectorAll<HTMLElement>("[data-shortcut-pane]")).some(isShortcutVisible)) return;
      event.preventDefault();
      clear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasSelection, clear]);
}
