"use client";

/**
 * Canonical Enterprise Tabs — use for all platform workspace tab rails.
 * Sizing, truncation, badges, overflow, and active indicator live here.
 * Do not add page-specific tab CSS overrides.
 */

import { useState, type ReactNode } from "react";
import { GripVerticalIcon } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type EnterpriseTabVariant = "underline" | "pill" | "plain";
export type EnterpriseTabOverflow = "scroll" | "wrap";

export type EnterpriseTabItem = {
  value: string;
  label: string;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
};

type EnterpriseTabsListProps = {
  variant?: EnterpriseTabVariant;
  /** Default `scroll` — wrap only when explicitly intended. */
  overflow?: EnterpriseTabOverflow;
  className?: string;
  listClassName?: string;
  children: ReactNode;
  /** Optional aria label for the tab list */
  "aria-label"?: string;
};

export function EnterpriseTabsList({
  variant = "underline",
  overflow = "scroll",
  className,
  listClassName,
  children,
  "aria-label": ariaLabel = "Workspace tabs",
}: EnterpriseTabsListProps) {
  return (
    <div className={cn("enterprise-tabs", className)} data-variant={variant}>
      <TabsPrimitive.List
        data-slot="enterprise-tabs"
        data-overflow={overflow}
        aria-label={ariaLabel}
        className={cn("enterprise-tabs-list", listClassName)}
      >
        {children}
      </TabsPrimitive.List>
    </div>
  );
}

/** Non-Radix list (client/vendor entity profiles). */
export function EnterpriseTabsRow({
  variant = "plain",
  overflow = "scroll",
  className,
  listClassName,
  children,
  "aria-label": ariaLabel = "Workspace tabs",
}: EnterpriseTabsListProps) {
  return (
    <div className={cn("enterprise-tabs", className)} data-variant={variant}>
      <div
        role="tablist"
        data-slot="enterprise-tabs"
        data-overflow={overflow}
        aria-label={ariaLabel}
        className={cn("enterprise-tabs-list", listClassName)}
      >
        {children}
      </div>
    </div>
  );
}

type TabVisualProps = {
  label: string;
  count?: number;
  icon?: ReactNode;
  grip?: ReactNode;
  showIndicator?: boolean;
};

function EnterpriseTabVisual({
  label,
  count,
  icon,
  grip,
  showIndicator = true,
}: TabVisualProps) {
  return (
    <>
      {grip}
      {icon ? <span className="enterprise-tab-icon">{icon}</span> : null}
      <span className="enterprise-tab-label" title={label}>
        {label}
      </span>
      {count != null ? (
        <span className="enterprise-tab-badge tabular-nums">{count}</span>
      ) : null}
      {showIndicator ? <span className="enterprise-tab-indicator" aria-hidden /> : null}
    </>
  );
}

type EnterpriseTabTriggerProps = EnterpriseTabItem & {
  className?: string;
  draggable?: boolean;
  dragIndex?: number;
  isDragOver?: boolean;
  isDragging?: boolean;
  onTabDragStart?: (index: number) => void;
  onTabDragOver?: (index: number) => void;
  onTabDrop?: (index: number) => void;
  onTabDragEnd?: () => void;
};

/** Radix Tabs trigger — canonical interactive tab. */
export function EnterpriseTabTrigger({
  value,
  label,
  count,
  icon,
  disabled,
  className,
  draggable = false,
  dragIndex,
  isDragOver = false,
  isDragging = false,
  onTabDragStart,
  onTabDragOver,
  onTabDrop,
  onTabDragEnd,
}: EnterpriseTabTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      disabled={disabled}
      data-slot="enterprise-tab"
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
        "enterprise-tab",
        isDragOver && "is-drag-over",
        isDragging && "is-dragging",
        className
      )}
    >
      <EnterpriseTabVisual
        label={label}
        count={count}
        icon={icon}
        grip={
          draggable && dragIndex != null ? (
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
              className="enterprise-tab-grip"
            >
              <GripVerticalIcon className="size-3.5" aria-hidden />
            </span>
          ) : null
        }
      />
    </TabsPrimitive.Trigger>
  );
}

type EnterpriseTabButtonProps = EnterpriseTabItem & {
  active?: boolean;
  className?: string;
  onClick?: () => void;
};

/** Controlled button tab for non-Radix workspaces (entity profiles). */
export function EnterpriseTabButton({
  value,
  label,
  count,
  icon,
  disabled,
  active = false,
  className,
  onClick,
}: EnterpriseTabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      id={`enterprise-tab-${value}`}
      aria-selected={active}
      aria-controls={`enterprise-tab-panel-${value}`}
      disabled={disabled}
      data-slot="enterprise-tab"
      data-state={active ? "active" : "inactive"}
      className={cn("enterprise-tab", active && "is-active", className)}
      onClick={onClick}
    >
      <EnterpriseTabVisual label={label} count={count} icon={icon} />
    </button>
  );
}

type EnterpriseSortableTabsBarProps<T extends string> = {
  variant?: EnterpriseTabVariant;
  overflow?: EnterpriseTabOverflow;
  tabOrder: readonly T[];
  tabsById: Record<T, EnterpriseTabItem>;
  onReorder: (fromIndex: number, toIndex: number) => void;
  className?: string;
  listClassName?: string;
  "aria-label"?: string;
};

/** Drag-to-reorder enterprise tab rail used by campaign/group/finance workspaces. */
export function EnterpriseSortableTabsBar<T extends string>({
  variant = "underline",
  overflow = "scroll",
  tabOrder,
  tabsById,
  onReorder,
  className,
  listClassName,
  "aria-label": ariaLabel,
}: EnterpriseSortableTabsBarProps<T>) {
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
    <EnterpriseTabsList
      variant={variant}
      overflow={overflow}
      className={className}
      listClassName={listClassName}
      aria-label={ariaLabel}
    >
      {tabOrder.map((tabId, index) => {
        const tab = tabsById[tabId];
        if (!tab) return null;
        return (
          <EnterpriseTabTrigger
            key={tabId}
            value={tab.value}
            label={tab.label}
            count={tab.count}
            icon={tab.icon}
            disabled={tab.disabled}
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
    </EnterpriseTabsList>
  );
}
