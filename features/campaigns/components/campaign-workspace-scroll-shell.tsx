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
 * Single scroll region: hero/KPIs scroll away; Aurora panel tab rail pins to the top.
 * Uses scroll listeners (not document sticky) so pinning works when dashboard main is locked.
 */
export function CampaignWorkspaceScrollShell({
  chrome,
  tabs,
  children,
}: CampaignWorkspaceScrollShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
    const panelEl = panelRef.current;
    const tabsEl = tabsRef.current;
    if (!scrollEl || !sentinel || !panelEl || !tabsEl) return;

    measureTabs();

    const scrollRect = scrollEl.getBoundingClientRect();
    const sentinelRect = sentinel.getBoundingClientRect();
    const shouldPin = sentinelRect.top <= scrollRect.top + 1;

    setTabsPinned(shouldPin);

    if (!shouldPin) {
      setPinStyle(undefined);
      return;
    }

    const panelRect = panelEl.getBoundingClientRect();
    setPinStyle({
      position: "fixed",
      top: scrollRect.top,
      left: panelRect.left,
      width: panelRect.width,
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
      className="h-0 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain overscroll-x-none bg-[var(--camp-surface)]"
      data-campaign-workspace-scroll
    >
      <div className="thinkway-aurora-wrap">
        <div className="thinkway-campaign-header">{chrome}</div>
        <div ref={panelRef} className="thinkway-aurora-panel">
          <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
          {tabsPinned && tabsHeight > 0 ? (
            <div style={{ height: tabsHeight }} className="shrink-0" aria-hidden />
          ) : null}
          <div
            ref={tabsRef}
            style={tabsPinned ? pinStyle : undefined}
            className={cn(
              "thinkway-aurora-panel-tabs thinkway-campaign-workspace-tabs-pinned z-40",
              tabsPinned && "border-b border-[var(--camp-hair)] bg-[var(--camp-white)] shadow-sm",
              !tabsPinned && "relative"
            )}
            data-sticky="campaign-workspace-tabs"
            data-pinned={tabsPinned ? "true" : "false"}
          >
            {tabs}
          </div>
          <div className="thinkway-aurora-panel-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
