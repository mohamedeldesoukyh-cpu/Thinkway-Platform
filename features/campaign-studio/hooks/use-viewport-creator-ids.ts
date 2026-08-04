"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Tracks creator ids that have entered (or neared) the viewport.
 * Used to drive Studio hydration without a fixed "first N" batch.
 */
export function useViewportCreatorIds(options?: {
  /** Prefetch margin so cards hydrate just before they scroll into view. */
  rootMargin?: string;
  /** Optional scroll root (defaults to viewport). */
  root?: Element | null;
}) {
  const { rootMargin = "240px 0px", root = null } = options ?? {};
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const seenRef = useRef(new Set<string>());
  const elementsRef = useRef(new Map<string, Element>());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const syncObserver = useCallback(() => {
    observerRef.current?.disconnect();
    if (typeof IntersectionObserver === "undefined") {
      // SSR / unsupported — expose all registered ids so hydration still proceeds.
      const all = [...elementsRef.current.keys()];
      seenRef.current = new Set(all);
      setVisibleIds(all);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.creatorHydrationId;
          if (!id || seenRef.current.has(id)) continue;
          seenRef.current.add(id);
          changed = true;
        }
        if (changed) {
          setVisibleIds([...seenRef.current]);
        }
      },
      { root, rootMargin, threshold: 0 }
    );
    observerRef.current = observer;
    for (const el of elementsRef.current.values()) {
      observer.observe(el);
    }
  }, [root, rootMargin]);

  useEffect(() => {
    syncObserver();
    return () => observerRef.current?.disconnect();
  }, [syncObserver]);

  const bindCreatorVisibility = useCallback(
    (creatorId: string | null | undefined, node: HTMLElement | null) => {
      if (!creatorId) return;
      const prev = elementsRef.current.get(creatorId);
      if (prev && prev !== node) {
        observerRef.current?.unobserve(prev);
        elementsRef.current.delete(creatorId);
      }
      if (!node) {
        elementsRef.current.delete(creatorId);
        return;
      }
      node.dataset.creatorHydrationId = creatorId;
      elementsRef.current.set(creatorId, node);
      observerRef.current?.observe(node);

      // Immediate check — IntersectionObserver callbacks can lag one frame.
      if (typeof IntersectionObserver === "undefined") {
        if (!seenRef.current.has(creatorId)) {
          seenRef.current.add(creatorId);
          setVisibleIds([...seenRef.current]);
        }
        return;
      }
      const rect = node.getBoundingClientRect();
      const marginPx = 240;
      const inView =
        rect.bottom >= -marginPx &&
        rect.top <= (typeof window !== "undefined" ? window.innerHeight : 0) + marginPx;
      if (inView && !seenRef.current.has(creatorId)) {
        seenRef.current.add(creatorId);
        setVisibleIds([...seenRef.current]);
      }
    },
    []
  );

  /** Ref callback factory — stable binder avoids tearing down observers each render. */
  const observeCreator = useCallback(
    (creatorId: string | null | undefined) => (node: HTMLElement | null) => {
      bindCreatorVisibility(creatorId, node);
    },
    [bindCreatorVisibility]
  );

  const reset = useCallback(() => {
    seenRef.current = new Set();
    setVisibleIds([]);
  }, []);

  const visibleKey = useMemo(() => visibleIds.join(","), [visibleIds]);

  return { visibleCreatorIds: visibleIds, visibleKey, observeCreator, reset };
}

/**
 * Adaptive bootstrap count when IO has not reported yet (SSR/first paint).
 * Derived from viewport height — not a fixed product constant.
 */
export function estimateViewportHydrationSeedCount(): number {
  if (typeof window === "undefined") return 4;
  const approxCardHeightPx = 96;
  return Math.max(3, Math.min(12, Math.ceil(window.innerHeight / approxCardHeightPx)));
}
