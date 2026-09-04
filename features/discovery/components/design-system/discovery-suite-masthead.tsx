"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

export type DiscoverySuiteMetricTone = "g" | "r" | "y" | "s" | undefined;

export type DiscoverySuiteMetric = {
  label: string;
  value: string | number;
  tone?: DiscoverySuiteMetricTone;
};

type DiscoverySuiteMastheadProps = {
  title: string;
  /** Serial / id chip */
  id?: string | null;
  badge?: ReactNode;
  metrics?: DiscoverySuiteMetric[];
  actions?: ReactNode;
  className?: string;
  /** Enable scroll → .mini past 64px (spec §4). */
  freezeOnScroll?: boolean;
};

const TONE_CLASS: Record<Exclude<DiscoverySuiteMetricTone, undefined>, string> = {
  g: "ok",
  r: "bad",
  y: "wrn",
  s: "",
};

/**
 * Spec §4 masthead: `.tw-frozen > .tw-mast > .tw-mh + .tw-mb + .tw-mr`.
 * Only render metrics with meaningful values (honesty: never invent / skip bare 0 when omitted by caller).
 */
export function DiscoverySuiteMasthead({
  title,
  id,
  badge,
  metrics = [],
  actions,
  className,
  freezeOnScroll = true,
}: DiscoverySuiteMastheadProps) {
  useEffect(() => {
    if (!freezeOnScroll) return;
    const root = document.getElementById("discovery-suite-frozen");
    if (!root) return;
    const onScroll = () => {
      if (window.scrollY > 64) root.classList.add("mini");
      else root.classList.remove("mini");
    };
    // Also listen to nearest overflow scroll parent
    const scroller =
      root.closest('[data-discovery-scroll]') ??
      root.parentElement?.querySelector(".overflow-y-auto") ??
      null;
    const target: EventTarget = scroller ?? window;
    const handler = () => {
      const y =
        scroller instanceof HTMLElement ? scroller.scrollTop : window.scrollY;
      if (y > 64) root.classList.add("mini");
      else root.classList.remove("mini");
    };
    target.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => target.removeEventListener("scroll", handler);
  }, [freezeOnScroll]);

  const shown = metrics.filter((m) => {
    if (m.value === "" || m.value == null) return false;
    return true;
  });

  return (
    <div
      id="discovery-suite-frozen"
      className={cn("tw-frozen", className)}
      data-discovery-frozen
    >
      <div className="tw-mast">
        <div className="tw-mh">
          <div className="tw-mh__t">
            {id ? <span className="id">{id}</span> : null}
            <h1>{title}</h1>
            {badge}
          </div>
          {actions ? <div className="tw-mr">{actions}</div> : null}
        </div>
        {shown.length > 0 ? (
          <div className="tw-mb" role="group" aria-label="Page metrics">
            {shown.map((m) => (
              <div
                key={m.label}
                className={cn("tw-ms2", TONE_CLASS[m.tone ?? "s"] || undefined)}
              >
                <i>{m.label}</i>
                <b>{m.value}</b>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
