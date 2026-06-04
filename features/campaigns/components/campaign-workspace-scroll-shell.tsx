"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

type CampaignWorkspaceScrollShellProps = {
  chrome: ReactNode;
  tabs: ReactNode;
  children: ReactNode;
};

/**
 * Single scroll region: title/KPI scroll away; tab rail pins to the top of this container.
 * Uses scroll listeners (not document sticky) so pinning works when dashboard main is locked.
 */
export function CampaignWorkspaceScrollShell({
  chrome,
  tabs,
  children,
}: CampaignWorkspaceScrollShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabsPinned, setTabsPinned] = useState(false);
  const [tabsHeight, setTabsHeight] = useState(0);
  const [pinStyle, setPinStyle] = useState<CSSProperties | undefined>();

  const measureTabs = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setTabsHeight(el.offsetHeight);
  }, []);

  const updatePin = useCallback(() => {
    const scrollEl = scrollRef.current;
    const sentinel = sentinelRef.current;
    const tabsEl = tabsRef.current;
    if (!scrollEl || !sentinel || !tabsEl) return;

    measureTabs();

    const scrollRect = scrollEl.getBoundingClientRect();
    const sentinelRect = sentinel.getBoundingClientRect();
    const shouldPin = sentinelRect.top <= scrollRect.top + 1;

    setTabsPinned(shouldPin);

    if (!shouldPin) {
      setPinStyle(undefined);
      return;
    }

    setPinStyle({
      position: "fixed",
      top: scrollRect.top,
      left: scrollRect.left,
      width: scrollRect.width,
      zIndex: 40,
    });
  }, [measureTabs]);

  useLayoutEffect(() => {
    measureTabs();
    updatePin();
  }, [measureTabs, updatePin]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const onScroll = () => updatePin();
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const ro = new ResizeObserver(() => {
      measureTabs();
      updatePin();
    });
    ro.observe(scrollEl);
    if (tabsRef.current) ro.observe(tabsRef.current);

    return () => {
      scrollEl.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      ro.disconnect();
    };
  }, [measureTabs, updatePin]);

  return (
    <div
      ref={scrollRef}
      className="h-0 min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain"
      data-campaign-workspace-scroll
    >
      <div className="space-y-4">{chrome}</div>
      <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
      {tabsPinned && tabsHeight > 0 ? (
        <div style={{ height: tabsHeight }} className="shrink-0" aria-hidden />
      ) : null}
      <div
        ref={tabsRef}
        style={tabsPinned ? pinStyle : undefined}
        className={cn(
          "thinkway-campaign-workspace-tabs-pinned z-40 -mx-3 px-3 md:-mx-6 md:px-6",
          "border-y-4 border-card bg-background pb-0",
          !tabsPinned && "relative"
        )}
        data-sticky="campaign-workspace-tabs"
        data-pinned={tabsPinned ? "true" : "false"}
      >
        {tabs}
      </div>
      {children}
    </div>
  );
}
