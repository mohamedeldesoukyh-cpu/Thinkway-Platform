"use client";

import { useCallback, useRef, type PointerEvent, type ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon, SparklesIcon } from "lucide-react";

const COLLAPSED_HEIGHT = 48;
const MIN_HEIGHT = 220;

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
 * Persistent bottom chat dock (VS Code terminal / Messenger style). The Studio
 * stays primary above it; the dock collapses to a slim bar and is drag-resizable,
 * so the chat is always available without permanently splitting the screen.
 */
export function CampaignCopilotDock({
  collapsed,
  onToggleCollapsed,
  height,
  onHeightChange,
  title = "Campaign Copilot",
  subtitle,
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
      // Dragging up grows the dock.
      const delta = startRef.current.y - event.clientY;
      const maxHeight =
        typeof window !== "undefined" ? Math.round(window.innerHeight * 0.75) : 600;
      const next = Math.min(maxHeight, Math.max(MIN_HEIGHT, startRef.current.height + delta));
      onHeightChange(next);
    },
    [onHeightChange]
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div
      className="relative z-10 flex shrink-0 flex-col border-t border-border bg-background shadow-[0_-10px_28px_rgba(6,8,16,0.08)]"
      style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
    >
      {!collapsed ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the Copilot chat"
          className="absolute inset-x-0 -top-1.5 z-20 flex h-3 cursor-ns-resize touch-none items-center justify-center"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <span className="h-1 w-10 rounded-full bg-border transition-colors hover:bg-[#1D9E75]" />
        </div>
      ) : null}

      <button
        type="button"
        className="flex h-12 shrink-0 items-center gap-2 px-4 text-left transition-colors hover:bg-muted/40"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "Expand the Campaign Copilot chat" : "Collapse the Campaign Copilot chat"}
      >
        <span className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
          <SparklesIcon className="size-3.5 text-white" />
        </span>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {subtitle ? (
          <span className="hidden truncate text-xs text-muted-foreground sm:inline">{subtitle}</span>
        ) : null}
        <span className="ml-auto text-muted-foreground">
          {collapsed ? (
            <ChevronUpIcon className="size-4" aria-hidden />
          ) : (
            <ChevronDownIcon className="size-4" aria-hidden />
          )}
        </span>
      </button>

      {!collapsed ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      ) : null}
    </div>
  );
}
