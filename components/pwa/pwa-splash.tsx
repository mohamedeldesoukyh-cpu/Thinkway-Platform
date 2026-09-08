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

    const hide = () => {
      el.setAttribute("data-done", "true");
    };

    // Client Review / token links must never stay under the black splash.
    // Standalone restore (pageshow) can otherwise leave a full-screen cover.
    const path = window.location.pathname;
    if (path.startsWith("/review")) {
      hide();
      return;
    }

    if (!isStandaloneDisplay()) {
      hide();
      return;
    }

    const timer = window.setTimeout(hide, 900);
    if (document.readyState === "complete") {
      window.setTimeout(hide, 400);
    } else {
      window.addEventListener("load", () => window.setTimeout(hide, 400), {
        once: true,
      });
    }

    const onPageShow = () => hide();
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
