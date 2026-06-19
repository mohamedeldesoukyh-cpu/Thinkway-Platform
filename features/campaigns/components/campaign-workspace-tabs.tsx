"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { GripVerticalIcon } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { TabsContent } from "@/components/ui/tabs";
import { OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS } from "@/components/workspace/operational-workspace-ui";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import { cn } from "@/lib/utils";

export type CampaignWorkspaceTabDef = {
  value: string;
  label: string;
  count?: number;
};

type CampaignWorkspaceTabTriggerProps = CampaignWorkspaceTabDef & {
  draggable?: boolean;
  dragIndex?: number;
  isDragOver?: boolean;
  isDragging?: boolean;
  onTabDragStart?: (index: number) => void;
  onTabDragOver?: (index: number) => void;
  onTabDrop?: (index: number) => void;
  onTabDragEnd?: () => void;
};

/** High-contrast workspace tab — easy to scan on the pinned rail. */
export function CampaignWorkspaceTabTrigger({
  value,
  label,
  count,
  draggable = false,
  dragIndex,
  isDragOver = false,
  isDragging = false,
  onTabDragStart,
  onTabDragOver,
  onTabDrop,
  onTabDragEnd,
}: CampaignWorkspaceTabTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      data-slot="campaign-workspace-tab"
      onDragOver={
        draggable && dragIndex != null
          ? (event) => {
              event.preventDefault();
              onTabDragOver?.(dragIndex);
            }
          : undefined
      }
      onDrop={
        draggable && dragIndex != null
          ? (event) => {
              event.preventDefault();
              onTabDrop?.(dragIndex);
            }
          : undefined
      }
      className={cn(
        "group/campaign-tab relative inline-flex shrink-0 cursor-pointer items-center gap-1.5",
        "rounded-t-lg border border-transparent px-3 py-2 text-[13px] font-medium transition-all",
        "bg-muted/50 text-muted-foreground",
        "hover:bg-muted/80 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[state=active]:z-[2] data-[state=active]:-mb-px data-[state=active]:border-border/80",
        "data-[state=active]:border-b-background data-[state=active]:bg-card",
        "data-[state=active]:px-4 data-[state=active]:font-semibold data-[state=active]:text-foreground",
        "data-[state=active]:before:absolute data-[state=active]:before:inset-x-2 data-[state=active]:before:top-0",
        "data-[state=active]:before:h-0.5 data-[state=active]:before:rounded-full data-[state=active]:before:bg-[var(--brand-product)]",
        draggable && isDragOver && "ring-2 ring-[var(--brand-product)]/40",
        draggable && isDragging && "opacity-50"
      )}
    >
      {draggable && dragIndex != null ? (
        <span
          draggable
          title="Drag to reorder tabs"
          aria-label={`Reorder ${label} tab`}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(dragIndex));
            onTabDragStart?.(dragIndex);
          }}
          onDragEnd={() => onTabDragEnd?.()}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          className={cn(
            "inline-flex shrink-0 cursor-grab touch-none items-center rounded-sm p-0.5 text-muted-foreground/50",
            "opacity-60 transition-opacity group-hover/campaign-tab:opacity-100",
            "hover:text-foreground active:cursor-grabbing"
          )}
        >
          <GripVerticalIcon className="size-3.5" aria-hidden />
        </span>
      ) : null}
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

type CampaignWorkspaceSortableTabsBarProps = {
  tabOrder: readonly CampaignWorkspaceTabId[];
  tabsById: Record<CampaignWorkspaceTabId, CampaignWorkspaceTabDef>;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export function CampaignWorkspaceSortableTabsBar({
  tabOrder,
  tabsById,
  onReorder,
}: CampaignWorkspaceSortableTabsBarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const clearDragState = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (toIndex: number) => {
    if (dragIndex == null || dragIndex === toIndex) {
      clearDragState();
      return;
    }
    onReorder(dragIndex, toIndex);
    clearDragState();
  };

  return (
    <CampaignWorkspaceTabsBar>
      {tabOrder.map((tabId, index) => {
        const tab = tabsById[tabId];
        if (!tab) return null;

        return (
          <CampaignWorkspaceTabTrigger
            key={tabId}
            value={tab.value}
            label={tab.label}
            count={tab.count}
            draggable
            dragIndex={index}
            isDragging={dragIndex === index}
            isDragOver={dragOverIndex === index && dragIndex !== index}
            onTabDragStart={setDragIndex}
            onTabDragOver={setDragOverIndex}
            onTabDrop={handleDrop}
            onTabDragEnd={clearDragState}
          />
        );
      })}
    </CampaignWorkspaceTabsBar>
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

/** Keeps tab panels mounted so deferred bundles stay warm and tab state survives switches. */
export function CampaignWorkspaceTabContent({
  className,
  ...props
}: ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent
      forceMount
      className={cn(OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS, className)}
      {...props}
    />
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
