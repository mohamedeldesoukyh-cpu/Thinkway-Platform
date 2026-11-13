"use client";

import { useId, useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, Columns3Icon, GripVerticalIcon, RotateCcwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import type { OverviewColumn } from "@/lib/reports/overview/overview-report";
import { cn } from "@/lib/utils";

import styles from "./overview-report.module.css";
import { moveOverviewColumn, OVERVIEW_COLUMN_META, stepOverviewColumn } from "./overview-report-ui";

export type OverviewSaveStatus = { tone: "success" | "error"; text: string } | null;

type OverviewColumnSettingsProps = {
  /** Full column order, hidden columns included (their positions are kept). */
  order: OverviewColumn[];
  /** Visible column keys. */
  visible: OverviewColumn[];
  saving: boolean;
  /** Current selection differs from the one saved to the account. */
  dirty: boolean;
  status: OverviewSaveStatus;
  onToggle: (key: OverviewColumn, shown: boolean) => void;
  onOrderChange: (order: OverviewColumn[]) => void;
  onSave: () => void;
  onReset: () => void;
};

/**
 * Report-local column settings: switches, drag ordering and an accessible
 * Move up / Move down equivalent. Ordering always goes through
 * orderOverviewColumns (via moveOverviewColumn), as before.
 */
export function OverviewColumnSettings({
  order,
  visible,
  saving,
  dirty,
  status,
  onToggle,
  onOrderChange,
  onSave,
  onReset,
}: OverviewColumnSettingsProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const titleId = useId();
  const helpId = useId();
  const visibleSet = new Set(visible);

  const announce = (next: OverviewColumn[], key: OverviewColumn) => {
    setAnnouncement(`${OVERVIEW_COLUMN_META[key].fullName} moved to position ${next.indexOf(key) + 1} of ${next.length}.`);
  };

  const step = (key: OverviewColumn, direction: -1 | 1) => {
    if (saving) return;
    const next = stepOverviewColumn(order, key, direction);
    if (next === order) return;
    onOrderChange(next);
    announce(next, key);
  };

  const drop = (to: number) => {
    if (dragIndex == null || saving) return;
    const key = order[dragIndex];
    const next = moveOverviewColumn(order, dragIndex, to);
    setDragIndex(null);
    setOverIndex(null);
    if (next === order) return;
    onOrderChange(next);
    announce(next, key);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="relative">
          <Columns3Icon data-icon="inline-start" className="size-3.5" aria-hidden />
          Columns
          <span className="rounded-full bg-muted px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            {visible.length}/{order.length}
          </span>
          {dirty && (
            <>
              <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-card bg-[var(--amber)]" />
              <span className="sr-only">(unsaved changes)</span>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-labelledby={titleId}
        aria-describedby={helpId}
        collisionPadding={12}
        className={cn(styles.tokens, "flex max-h-[min(36rem,var(--radix-popover-content-available-height),calc(100dvh-1.5rem))] w-[min(25rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border-border/55 shadow-xl")}
      >
        <div className="shrink-0 border-b border-border/50 px-4 pb-3 pt-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id={titleId} className="text-sm font-semibold tracking-tight text-foreground">Table columns</h3>
            <span className="text-xs tabular-nums text-muted-foreground">{visible.length} of {order.length} shown</span>
          </div>
          <p id={helpId} className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Changes apply to the table and exports right away. Drag a row or use the arrows to reorder; totals stay beside their related columns.
          </p>
        </div>

        <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2" aria-label="Columns in display order">
          {order.map((key, index) => {
            const meta = OVERVIEW_COLUMN_META[key];
            const shown = visibleSet.has(key);
            const isLastVisible = shown && visible.length === 1;
            const canUp = stepOverviewColumn(order, key, -1) !== order;
            const canDown = stepOverviewColumn(order, key, 1) !== order;
            const anchored = !canUp && !canDown;
            return (
              <li
                key={key}
                onDragOver={event => {
                  if (dragIndex == null) return;
                  event.preventDefault();
                  setOverIndex(index);
                }}
                onDragLeave={() => setOverIndex(current => (current === index ? null : current))}
                onDrop={event => {
                  event.preventDefault();
                  drop(index);
                }}
                className={cn(
                  "group/col flex items-center gap-1.5 rounded-xl px-1.5 py-1 transition-colors",
                  overIndex === index && dragIndex !== index && "bg-[var(--brand-product)]/8 ring-1 ring-[var(--brand-product)]/30",
                  dragIndex === index && "opacity-50",
                  !shown && "text-muted-foreground",
                )}
              >
                <span
                  draggable={!saving && !anchored}
                  aria-hidden
                  title={anchored ? "Positioned automatically beside related columns" : "Drag to reorder"}
                  onDragStart={event => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", key);
                    setDragIndex(index);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-md p-1 text-muted-foreground/45",
                    anchored ? "cursor-default opacity-40" : "cursor-grab hover:bg-muted hover:text-foreground active:cursor-grabbing",
                  )}
                >
                  <GripVerticalIcon className="size-3.5" />
                </span>
                <span className={styles.swatch} data-kind={meta.kind} aria-hidden />
                <span className="min-w-0 flex-1 px-1">
                  <span className={cn("block truncate text-sm", shown ? "font-medium text-foreground" : "text-muted-foreground")}>{meta.label}</span>
                  {meta.label.toLowerCase() !== meta.fullName.toLowerCase() && (
                    <span className="block truncate text-[11px] leading-4 text-muted-foreground">{meta.fullName}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center opacity-70 transition-opacity group-hover/col:opacity-100 group-focus-within/col:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${meta.fullName} up`}
                    aria-disabled={!canUp || saving}
                    title={anchored ? "Positioned automatically beside related columns" : "Move up"}
                    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
                    onClick={() => canUp && step(key, -1)}
                  >
                    <ArrowUpIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${meta.fullName} down`}
                    aria-disabled={!canDown || saving}
                    title={anchored ? "Positioned automatically beside related columns" : "Move down"}
                    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-30"
                    onClick={() => canDown && step(key, 1)}
                  >
                    <ArrowDownIcon aria-hidden />
                  </Button>
                </span>
                <Switch
                  checked={shown}
                  disabled={saving || isLastVisible}
                  title={isLastVisible ? "At least one column must stay visible" : undefined}
                  aria-label={`Show ${meta.fullName} column`}
                  onCheckedChange={checked => onToggle(key, checked)}
                  className="ml-1"
                />
              </li>
            );
          })}
        </ol>
        <p className="sr-only" aria-live="polite">{announcement}</p>

        <div className="shrink-0 space-y-2.5 border-t border-border/50 bg-muted/30 px-4 py-3">
          <p
            role="status"
            className={cn(
              "flex min-h-4 items-center gap-1.5 text-xs",
              status?.tone === "error" ? "font-medium text-destructive" : status?.tone === "success" ? "text-[var(--green-text,#065f46)]" : "text-muted-foreground",
            )}
          >
            {!status && dirty && <span aria-hidden className="size-1.5 rounded-full bg-[var(--amber)]" />}
            {saving ? "Saving to your account…" : status?.text ?? (dirty ? "Unsaved column changes" : "Your saved selection")}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={saving}
              onClick={onReset}
              title="Restore the default columns and order, and save them as your selection"
              className="-ml-2 text-muted-foreground"
            >
              <RotateCcwIcon data-icon="inline-start" className="size-3.5" aria-hidden />
              Reset columns
            </Button>
            <Button type="button" size="sm" disabled={saving || !dirty} onClick={onSave}>
              {saving ? "Saving…" : "Save selection"}
            </Button>
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">Saved to your account, so the same columns open on any device.</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
