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
  /** Optional subtitle under title (HTML `.tw-mh .sub`). */
  subtitle?: string | null;
  badge?: ReactNode;
  metrics?: DiscoverySuiteMetric[];
  /** White action strip (HTML `.tw-mr`) — sibling of `.tw-mh`, not inside it. */
  actions?: ReactNode;
  /** Optional lifecycle / quotation strip (HTML `.tw-mb`). */
  band?: ReactNode;
  className?: string;
  /** Enable scroll → .mini past 64px (spec §4). */
  freezeOnScroll?: boolean;
};

const TONE_CLASS: Record<Exclude<DiscoverySuiteMetricTone, undefined>, string> = {
  g: "g",
  r: "r",
  y: "y",
  s: "s",
};

/**
 * Spec §4 / discovery.html `bar()`:
 * `.tw-frozen > .tw-mast > .tw-mh` (+ optional `.tw-mb`) `+ .tw-mr` `+ .tw-ms2`
 * Metric strip is ONE `.tw-ms2` grid; each cell is `<div><i>label</i><b>value</b></div>`.
 */
export function DiscoverySuiteMasthead({
  title,
  id,
  subtitle,
  badge,
  metrics = [],
  actions,
  band,
  className,
  freezeOnScroll = true,
}: DiscoverySuiteMastheadProps) {
  useEffect(() => {
    if (!freezeOnScroll) return;
    const root = document.getElementById("discovery-suite-frozen");
    if (!root) return;
    const scroller =
      (root.closest("[data-discovery-scroll]") as HTMLElement | null) ??
      (root.parentElement?.closest("[data-discovery-scroll]") as HTMLElement | null) ??
      (document.querySelector(
        ".discovery-suite [data-discovery-scroll], .discovery-suite .overflow-y-auto"
      ) as HTMLElement | null);

    const handler = () => {
      const y = scroller ? scroller.scrollTop : window.scrollY;
      if (y > 64) root.classList.add("mini");
      else root.classList.remove("mini");
    };
    const target: EventTarget = scroller ?? window;
    target.addEventListener("scroll", handler, { passive: true });
    handler();
    return () => target.removeEventListener("scroll", handler);
  }, [freezeOnScroll]);

  const shown = metrics.filter((m) => m.value !== "" && m.value != null);

  return (
    <div
      id="discovery-suite-frozen"
      className={cn("tw-frozen", className)}
      data-discovery-frozen
    >
      <div className="tw-mast">
        <div className="tw-mh">
          <div
            className="tw-mh__t"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {id ? <span className="id">{id}</span> : null}
            <h1>{title}</h1>
            {badge}
            {subtitle ? <span className="sub">{subtitle}</span> : null}
          </div>
          <span className="tw-sp" />
        </div>
        {band ? <div className="tw-mb">{band}</div> : null}
        {actions ? <div className="tw-mr">{actions}</div> : null}
        {shown.length > 0 ? (
          <div className="tw-ms2" role="group" aria-label="Page metrics">
            {shown.map((m) => (
              <div key={m.label}>
                <i>{m.label}</i>
                <b className={m.tone ? TONE_CLASS[m.tone] : undefined}>{m.value}</b>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
