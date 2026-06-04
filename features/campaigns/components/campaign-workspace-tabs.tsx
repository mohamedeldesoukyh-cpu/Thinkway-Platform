"use client";

import type { ReactNode } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type CampaignWorkspaceTabDef = {
  value: string;
  label: string;
  count?: number;
};

/** High-contrast workspace tab — easy to scan on the pinned rail. */
export function CampaignWorkspaceTabTrigger({ value, label, count }: CampaignWorkspaceTabDef) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      data-slot="campaign-workspace-tab"
      className={cn(
        "group/campaign-tab relative inline-flex shrink-0 cursor-pointer items-center gap-2",
        "rounded-t-lg border border-transparent px-3 py-2 text-[13px] font-medium transition-all",
        "bg-muted/50 text-muted-foreground",
        "hover:bg-muted/80 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[state=active]:z-[2] data-[state=active]:-mb-px data-[state=active]:border-border/80",
        "data-[state=active]:border-b-background data-[state=active]:bg-card",
        "data-[state=active]:px-4 data-[state=active]:font-semibold data-[state=active]:text-foreground",
        "data-[state=active]:before:absolute data-[state=active]:before:inset-x-2 data-[state=active]:before:top-0",
        "data-[state=active]:before:h-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-[var(--brand-product)]"
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      {count != null ? (
        <span
          className={cn(
            "inline-flex min-w-[1.25rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            "bg-background/80 text-muted-foreground ring-1 ring-border/50",
            "group-data-[state=active]/campaign-tab:bg-muted group-data-[state=active]/campaign-tab:text-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export function CampaignWorkspaceTabsBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-t-xl bg-muted/40 px-2 pt-2"
      data-sticky="campaign-workspace-tabs"
    >
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
        Campaign workspace
      </p>
      <TabsPrimitive.List
        data-slot="campaign-workspace-tabs"
        className={cn(
          "flex min-w-0 items-end gap-2 overflow-x-auto pb-0.5",
          "scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {children}
      </TabsPrimitive.List>
    </div>
  );
}

/** Connects active tab to tab body (shared card surface). */
export function CampaignWorkspaceTabPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 bg-background", className)}>{children}</div>;
}
