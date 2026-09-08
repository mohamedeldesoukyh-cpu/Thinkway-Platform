"use client";

import { useEffect } from "react";

/**
 * Clears the SSR splash overlay after first paint.
 * Splash markup lives in root layout to avoid layout shift.
 */
export function PwaSplash() {
  useEffect(() => {
    const el = document.getElementById("pwa-splash");
    if (!el) return;

    const hide = () => {
      el.setAttribute("data-done", "true");
    };

    // Always clear immediately — never leave the black full-screen cover up,
    // including Client Review / WhatsApp WebView and bfcache restore.
    hide();

    const onPageShow = () => hide();
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
