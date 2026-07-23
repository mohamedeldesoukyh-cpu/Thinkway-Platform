"use client";

import { useEffect, useState } from "react";

/**
 * When any element is in native Fullscreen API mode, Radix portals that target
 * `document.body` render outside the fullscreen layer and are invisible.
 * Prefer this container so overlays stay on-screen while maximized.
 */
function readFullscreenContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  const el = document.fullscreenElement;
  return el instanceof HTMLElement ? el : undefined;
}

export function useFullscreenPortalContainer(): HTMLElement | undefined {
  const [container, setContainer] = useState<HTMLElement | undefined>(readFullscreenContainer);

  useEffect(() => {
    const sync = () => setContainer(readFullscreenContainer());
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  return container;
}
