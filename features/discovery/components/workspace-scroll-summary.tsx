"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import "./workspace-scroll-summary.css";

/** Like campaign chrome: preserve the full header's height while a compact summary pins. */
export function WorkspaceScrollSummary({ serial, name, status, metrics }: {
  serial: string | null; name: string; status: string;
  metrics: Array<{ label: string; value: string | number }>;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const compactRef = useRef(false);
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    const root = anchor.current?.closest<HTMLElement>("[data-discovery-workspace-scroll]");
    const header = root?.querySelector<HTMLElement>("[data-workspace-full-header]");
    const summary = anchor.current?.firstElementChild as HTMLElement | null;
    const tools = root?.querySelector<HTMLElement>(".q-lines__h, .sl-tbl__h");
    if (!root || !header || !summary) return;
    let mini = compactRef.current;
    const measure = () => {
      const headerEnd = header.getBoundingClientRect().bottom - root.getBoundingClientRect().top + root.scrollTop;
      // Separate enter/exit thresholds prevent flickering near the boundary.
      const next = root.scrollTop > headerEnd - (mini ? 56 : 8);
      if (next !== mini) { mini = next; compactRef.current = next; setCompact(next); }
      const height = mini ? summary.offsetHeight : 0;
      root.style.setProperty("--workspace-summary-height", `${height}px`);
      root.style.setProperty("--q-summary-visible", `${height}px`);
      root.style.setProperty("--q-lines-tools-height", `${tools?.offsetHeight ?? 0}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(header);
    observer.observe(summary);
    if (tools) observer.observe(tools);
    root.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => { observer.disconnect(); root.removeEventListener("scroll", measure); };
  });
  return (
    <div ref={anchor} className="discovery-workspace-minibar" data-compact={compact} aria-hidden={!compact}>
      <div className="discovery-workspace-minibar-inner">
        <div className="discovery-workspace-minibar-title">
          <span>{formatDocumentNumberForDisplay(serial)}</span><b>{name}</b><span>{status}</span>
        </div>
        <div className="discovery-workspace-minibar-metrics">
          {metrics.map((metric) => <span key={metric.label}>{metric.label} <b>{metric.value}</b></span>)}
        </div>
      </div>
    </div>
  );
}
