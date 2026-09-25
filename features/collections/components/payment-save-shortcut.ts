"use client";

import { useEffect } from "react";

/** Only the visible Collections receipt workspace owns this shortcut. */
export function usePaymentSaveShortcut() {
  useEffect(() => {
    function save(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey ||
        !(event.key.toLowerCase() === "s" || event.code === "KeyS")) return;
      const panel = document.getElementById("panel-record");
      if (!panel || panel.hidden) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || panel.querySelector('[data-payment-delete]')) return;
      const form = panel.querySelector<HTMLFormElement>('form[data-payment-edit]') ??
        panel.querySelector<HTMLFormElement>('form[data-payment-create]');
      if (!form || form.getAttribute("aria-busy") === "true") return;
      form.requestSubmit();
    }
    window.addEventListener("keydown", save, true);
    return () => window.removeEventListener("keydown", save, true);
  }, []);
}
