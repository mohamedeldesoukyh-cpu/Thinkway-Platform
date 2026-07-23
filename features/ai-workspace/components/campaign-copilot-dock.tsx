"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";
import { ChevronDownIcon } from "lucide-react";

import "../styles/copilot-ref.css";

const MIN_HEIGHT = 320;
const PANEL_WIDTH = 400;

function CopilotSparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3l1.9 4.5L18 9l-4.1 1.5L12 15l-1.9-4.5L6 9l4.1-1.5z" />
    </svg>
  );
}

type CampaignCopilotDockProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  /** Expanded height in px. */
  height: number;
  onHeightChange: (height: number) => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/**
 * Floating Campaign Copilot — reference FAB + resizable dock panel above it.
 */
export function CampaignCopilotDock({
  collapsed,
  onToggleCollapsed,
  height,
  onHeightChange,
  title = "Campaign Copilot",
  subtitle = "Editing assistant — refine any output",
  children,
}: CampaignCopilotDockProps) {
  const draggingRef = useRef(false);
  const startRef = useRef({ y: 0, height: 0 });

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      startRef.current = { y: event.clientY, height };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [height]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const delta = startRef.current.y - event.clientY;
      const maxHeight =
        typeof window !== "undefined" ? Math.round(window.innerHeight * 0.82) : 640;
      const next = Math.min(maxHeight, Math.max(MIN_HEIGHT, startRef.current.height + delta));
      onHeightChange(next);
    },
    [onHeightChange]
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  if (collapsed) {
    return (
      <div className="copilot-ref pointer-events-none">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Open Campaign Copilot"
          title={title}
          className="copilot-fab pointer-events-auto"
        >
          <div className="copilot-avatar">
            <CopilotSparkleIcon />
            <span className="copilot-ping" />
          </div>
          <div className="cf-text">
            <b>{title}</b>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="copilot-ref copilot-dock">
      <div className="copilot-panel" style={{ height }}>
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the Copilot chat"
          className="copilot-panel-resize"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <span />
        </div>

        <div className="copilot-panel-header">
          <span className="copilot-panel-header-icon">
            <CopilotSparkleIcon />
          </span>
          <div className="copilot-panel-header-text">
            <p>{title}</p>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded
            aria-label="Minimize Campaign Copilot"
            className="copilot-panel-minimize"
          >
            <ChevronDownIcon aria-hidden />
          </button>
        </div>

        <div className="copilot-panel-body">{children}</div>
      </div>
    </div>
  );
}
