"use client";

import type { CSSProperties, ReactNode } from "react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import {
  CREATOR_DETAIL_SHEET_MAX_WIDTH_PX,
  CREATOR_PICKER_SHEET_MAX_WIDTH_PX,
  DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX,
} from "./discovery-design-tokens";

/** @deprecated Use DISCOVERY_FILTER_SHEET_CLASS — slim 360px legacy width. */
export const DISCOVERY_SHEET_CONTENT_CLASS =
  "flex h-full w-[min(360px,90vw)] max-w-[360px] flex-col border-l border-[#e2e8f0] p-0 sm:max-w-[360px]";

export const DISCOVERY_FILTER_SHEET_STYLE = {
  width: `min(${DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX}px, 100vw)`,
  maxWidth: `${DISCOVERY_FILTER_SHEET_MAX_WIDTH_PX}px`,
} as const satisfies CSSProperties;

/** Filter drawer host — 70% of Creator Details width, matching detail sheet chrome. */
export const DISCOVERY_FILTER_SHEET_CLASS = cn(
  "discovery-filter-sheet flex flex-col gap-0 overflow-hidden border-l border-border bg-[#f8fafc] dark:bg-background p-0",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none shadow-[-8px_0_40px_rgba(15,23,42,0.1)] dark:shadow-[-8px_0_40px_rgba(0,0,0,0.35)]"
);

/** Workspace side sheet — same chrome as Creator Details (add creators, etc.). */
export const DISCOVERY_WORKSPACE_SHEET_STYLE = {
  width: `min(${CREATOR_DETAIL_SHEET_MAX_WIDTH_PX}px, 100vw)`,
  maxWidth: `${CREATOR_DETAIL_SHEET_MAX_WIDTH_PX}px`,
} as const satisfies CSSProperties;

export const DISCOVERY_WORKSPACE_SHEET_CLASS = cn(
  "discovery-workspace-sheet flex flex-col gap-0 overflow-hidden border-l border-border bg-[#f8fafc] dark:bg-background p-0",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none shadow-[-8px_0_40px_rgba(15,23,42,0.1)] dark:shadow-[-8px_0_40px_rgba(0,0,0,0.35)]"
);

/** Add creators picker — thinkway-add-creators.html */
export const CREATOR_PICKER_SHEET_STYLE = {
  width: `min(${CREATOR_PICKER_SHEET_MAX_WIDTH_PX}px, 100vw)`,
  maxWidth: `${CREATOR_PICKER_SHEET_MAX_WIDTH_PX}px`,
} as const satisfies CSSProperties;

export const CREATOR_PICKER_SHEET_CLASS = cn(
  "creator-picker-sheet flex flex-col gap-0 overflow-hidden border-l border-[#e2e8f0] bg-white p-0",
  "!inset-y-0 !right-0 !left-auto !h-full !max-h-none",
  "rounded-none shadow-[-12px_0_48px_rgba(15,23,42,0.14)]"
);

type DiscoveryFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: ReactNode;
  side?: "right" | "left";
  className?: string;
};

export function DiscoveryFilterSheet({
  open,
  onOpenChange,
  title = "Search filters",
  children,
  side = "right",
  className,
}: DiscoveryFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={false}
        showOverlay
        style={{
          width: "min(520px, 96vw)",
          maxWidth: "520px",
        }}
        className={cn(
          DISCOVERY_FILTER_SHEET_CLASS,
          "discovery-suite border-l border-[var(--tw-hair,#EDF0F5)] bg-white shadow-[-18px_0_48px_-18px_rgba(11,15,26,.4)]",
          className
        )}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        {children}
      </SheetContent>
    </Sheet>
  );
}
