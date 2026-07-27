"use client";

import { useEffect } from "react";

import { isStandaloneDisplay } from "@/lib/pwa/install-storage";

/**
 * Clears the SSR splash overlay after first paint in standalone mode.
 * Splash markup lives in root layout to avoid layout shift.
 */
export function PwaSplash() {
  useEffect(() => {
    const el = document.getElementById("pwa-splash");
    if (!el) return;

    if (!isStandaloneDisplay()) {
      el.setAttribute("data-done", "true");
      return;
    }

    const hide = () => {
      el.setAttribute("data-done", "true");
    };

    const timer = window.setTimeout(hide, 900);
    if (document.readyState === "complete") {
      window.setTimeout(hide, 400);
    } else {
      window.addEventListener("load", () => window.setTimeout(hide, 400), {
        once: true,
      });
    }

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
