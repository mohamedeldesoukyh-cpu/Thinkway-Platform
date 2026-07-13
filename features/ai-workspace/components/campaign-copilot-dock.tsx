"use client";

import { useCallback, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { ChevronDownIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const MIN_HEIGHT = 320;
const PANEL_WIDTH = 400;

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
 * Floating chatbot-style Campaign Copilot. Collapsed to a corner icon; opens a
 * resizable panel above it so the Studio keeps the full viewport.
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
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Open Campaign Copilot"
          className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border/60 bg-background py-2 pl-3 pr-2 shadow-lg shadow-black/10 ring-4 ring-background transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="flex flex-col items-end text-right leading-tight">
            <span className="text-xs font-semibold text-foreground">{title}</span>
            {subtitle ? (
              <span className="hidden max-w-[11rem] truncate text-[10px] text-muted-foreground sm:block">
                {subtitle}
              </span>
            ) : null}
          </span>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/25">
            <SparklesIcon className="size-5" aria-hidden />
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(var(--copilot-panel-width),calc(100vw-2.5rem))] flex-col sm:bottom-6 sm:right-6"
      style={{ "--copilot-panel-width": `${PANEL_WIDTH}px` } as CSSProperties}
    >
      <div
        className={cn(
          "pointer-events-auto relative flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-black/12",
          "animate-in fade-in slide-in-from-bottom-4 duration-200"
        )}
        style={{ height }}
      >
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

        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
            <SparklesIcon className="size-3.5 text-white" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            {subtitle ? (
              <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded
            aria-label="Minimize Campaign Copilot"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60"
          >
            <ChevronDownIcon className="size-4" aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
