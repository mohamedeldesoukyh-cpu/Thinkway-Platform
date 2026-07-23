"use client";

import { useEffect, useRef, useState } from "react";

type UseSectionBodyMountOptions = {
  /** Active nav section, running/blocked status, etc. */
  forceMount?: boolean;
  /** Prefetch distance above/below the viewport. */
  rootMargin?: string;
};

/**
 * Defers mounting heavy section bodies until near the viewport (or forced).
 * Once mounted, stays mounted to avoid flicker when scrolling back.
 */
export function useSectionBodyMount(options: UseSectionBodyMountOptions = {}) {
  const { forceMount = false, rootMargin = "280px 0px" } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(forceMount);

  useEffect(() => {
    if (forceMount) {
      setMounted(true);
    }
  }, [forceMount]);

  useEffect(() => {
    if (mounted) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setMounted(true);
          observer.disconnect();
        }
      },
      { root: null, rootMargin, threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, rootMargin]);

  return { containerRef, mounted };
}
