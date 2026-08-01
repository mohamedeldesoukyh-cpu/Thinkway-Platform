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

/** Underline tab — matches thinkway-campaign_2.html tabs bar. */
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
        "thinkway-campaign-tab group/campaign-tab relative shrink-0 cursor-pointer",
        "border-0 bg-transparent shadow-none outline-none",
        "focus-visible:ring-2 focus-visible:ring-[var(--camp-blue)]/30",
        draggable && isDragOver && "ring-2 ring-[var(--camp-blue)]/40",
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
            "mr-0.5 inline-flex shrink-0 cursor-grab touch-none items-center rounded-sm p-0.5",
            "text-[var(--camp-text-3)] opacity-60 transition-opacity group-hover/campaign-tab:opacity-100",
            "hover:text-[var(--camp-text-2)] active:cursor-grabbing"
          )}
        >
          <GripVerticalIcon className="size-3" aria-hidden />
        </span>
      ) : null}
      <span>{label}</span>
      {count != null ? (
        <span className="thinkway-campaign-tab-badge tabular-nums">{count}</span>
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
    <TabsPrimitive.List
      data-slot="campaign-workspace-tabs"
      className="thinkway-campaign-tabs-bar flex min-w-0 items-center"
    >
      {children}
    </TabsPrimitive.List>
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
      className={cn(
        OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS,
        "thinkway-campaign-tab-panel mt-0 outline-none focus-visible:outline-none",
        className
      )}
      {...props}
    />
  );
}

/** Tab body surface — reference content padding. */
export function CampaignWorkspaceTabPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("thinkway-campaign-content min-w-0", className)}>
      {children}
    </div>
  );
}
