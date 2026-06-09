"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { GripVerticalIcon } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OPERATIONAL_CHROME_META, OPERATIONAL_CHROME_TITLE } from "@/features/campaigns/components/assignment-hierarchy/operational-table-typography";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import {
  DETAIL_FIELD_LABEL_CLASS,
  DetailSheetFooter,
} from "@/features/campaigns/components/operational-detail-panel";
import { cn } from "@/lib/utils";

/** Tab body visibility — matches campaign workspace. */
export const OPERATIONAL_WORKSPACE_TAB_PANEL_CLASS =
  "mt-4 flex-none outline-none focus-visible:outline-none data-[state=inactive]:hidden";

export type OperationalWorkspaceTabDef = {
  value: string;
  label: string;
  count?: number;
};

type OperationalWorkspaceTabTriggerProps = OperationalWorkspaceTabDef & {
  draggable?: boolean;
  dragIndex?: number;
  isDragOver?: boolean;
  isDragging?: boolean;
  onTabDragStart?: (index: number) => void;
  onTabDragOver?: (index: number) => void;
  onTabDrop?: (index: number) => void;
  onTabDragEnd?: () => void;
};

/** Workspace tab pill — same visual language as campaign assignments rail. */
export function OperationalWorkspaceTabTrigger({
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
}: OperationalWorkspaceTabTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      data-slot="operational-workspace-tab"
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
        "group/ops-tab relative inline-flex shrink-0 cursor-pointer items-center gap-1.5",
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
            "opacity-60 transition-opacity group-hover/ops-tab:opacity-100",
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
            "group-data-[state=active]/ops-tab:bg-muted group-data-[state=active]/ops-tab:text-foreground"
          )}
        >
          {count}
        </span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export function OperationalWorkspaceTabsBar({
  sectionLabel,
  children,
}: {
  sectionLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-t-xl bg-muted/40 px-2 pt-2" data-sticky="operational-workspace-tabs">
      {sectionLabel ? (
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-foreground">
          {sectionLabel}
        </p>
      ) : null}
      <TabsPrimitive.List
        data-slot="operational-workspace-tabs"
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

type OperationalWorkspaceSortableTabsBarProps<T extends string> = {
  sectionLabel?: string;
  tabOrder: readonly T[];
  tabsById: Record<T, OperationalWorkspaceTabDef>;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

/** Drag-to-reorder tab rail — same behavior as campaign assignments workspace. */
export function OperationalWorkspaceSortableTabsBar<T extends string>({
  sectionLabel,
  tabOrder,
  tabsById,
  onReorder,
}: OperationalWorkspaceSortableTabsBarProps<T>) {
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
    <OperationalWorkspaceTabsBar sectionLabel={sectionLabel}>
      {tabOrder.map((tabId, index) => {
        const tab = tabsById[tabId];
        if (!tab) return null;

        return (
          <OperationalWorkspaceTabTrigger
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
    </OperationalWorkspaceTabsBar>
  );
}

export function OperationalWorkspaceTabPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("min-w-0 bg-background", className)}>{children}</div>;
}

/** Read-only label/value row — matches assignment detail field rhythm. */
export function OperationalDetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/40 py-3.5 last:border-b-0">
      <span className={DETAIL_FIELD_LABEL_CLASS}>{label}</span>
      <div className={cn("min-w-0 text-right text-sm text-foreground", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

/** Form / overview card shell — operational section header + body (+ optional footer). */
export function OperationalFormSection({
  title,
  description,
  actions,
  children,
  footer,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <OperationalTableSection
      wide
      tableOnly
      cardSurface
      className={className}
      leading={
        <CampaignOperationalSectionHeader
          title={title}
          description={description}
          actions={actions}
        />
      }
    >
      <div className="space-y-4 px-6 py-4">{children}</div>
      {footer ? <DetailSheetFooter>{footer}</DetailSheetFooter> : null}
    </OperationalTableSection>
  );
}

export function OperationalWorkspaceChrome({
  title,
  meta,
  badges,
  backButton,
}: {
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  backButton?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {backButton}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className={cn(OPERATIONAL_CHROME_TITLE, "truncate")}>{title}</h1>
          {badges}
        </div>
      </div>
      {meta ? <p className={cn(OPERATIONAL_CHROME_META, backButton ? "pl-10" : undefined)}>{meta}</p> : null}
    </div>
  );
}
