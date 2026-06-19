"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Scroll padding when the bar is visible (≈ Tailwind pb-28). */
export const FLOATING_ACTION_BAR_OFFSET = "7rem";

export type OperationalFloatingActionBarProps = {
  /** When false, the bar animates out and ignores pointer events. */
  visible: boolean;
  children: ReactNode;
  /** Optional messages rendered below the pill (coverage warnings, etc.). */
  messages?: ReactNode;
  className?: string;
};

/** Tailwind classes that reserve scroll space above the fixed floating bar. */
export const OPERATIONAL_FLOATING_BAR_CONTENT_CLASS =
  "pb-[var(--floating-action-bar-offset)] max-md:pb-[var(--floating-action-bar-offset-mobile)]";

/**
 * Apply bottom padding to scroll containers when a floating action bar is visible.
 */
export function operationalFloatingBarContentClass(
  visible: boolean,
  className?: string
): string {
  return cn(visible && OPERATIONAL_FLOATING_BAR_CONTENT_CLASS, className);
}

/**
 * Instagram-style floating pill for operational bulk actions.
 * Fixed above the viewport bottom; content scrolls horizontally on narrow screens.
 */
export function OperationalFloatingActionBar({
  visible,
  children,
  messages,
  className,
}: OperationalFloatingActionBarProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-6 z-40 flex flex-col items-center gap-2 px-4 pb-2 pt-2",
        "max-md:bottom-4 max-md:pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]",
        className
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-[calc(100vw-2rem)] transition-all duration-300 ease-out",
          visible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full min-w-0 items-center gap-2 overflow-x-auto rounded-2xl px-3 py-2 sm:rounded-full",
            "border border-white/70 bg-white/80 shadow-[0_8px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-150",
            "ring-1 ring-black/[0.04]",
            "dark:border-white/[0.1] dark:bg-[rgba(24,24,27,0.72)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)_inset] dark:ring-white/[0.06] dark:backdrop-blur-2xl dark:backdrop-saturate-150",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          )}
          role="toolbar"
          aria-label="Selection actions"
        >
          {children}
        </div>
        {messages ? (
          <div
            className={cn(
              "mx-auto mt-2 max-w-lg px-2 text-center transition-opacity duration-300",
              visible ? "opacity-100" : "opacity-0"
            )}
          >
            {messages}
          </div>
        ) : null}
      </div>
    </div>
  );
}
