"use client";

import { useCallback, useState } from "react";
import { GripVerticalIcon } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { OperationalTableColumnMeta } from "@/lib/tables/operational-table-column-settings";
import type { OperationalTableColumnState } from "@/lib/tables/operational-table-column-settings";

type OperationalTableColumnSettingsListProps = {
  orderedColumns: OperationalTableColumnMeta[];
  state: OperationalTableColumnState;
  toggleColumnVisibility: (columnId: string, visible: boolean) => void;
  moveColumn: (fromIndex: number, toIndex: number) => void;
  resetToDefault: () => void;
};

export function OperationalTableColumnSettingsList({
  orderedColumns,
  state,
  toggleColumnVisibility,
  moveColumn,
  resetToDefault,
}: OperationalTableColumnSettingsListProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDrop = useCallback(
    (toIndex: number) => {
      if (dragIndex == null) {
        return;
      }
      moveColumn(dragIndex, toIndex);
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, moveColumn]
  );

  return (
    <>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">Columns</p>
        <button
          type="button"
          onClick={resetToDefault}
          className="rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--brand-product)] transition-colors hover:bg-[var(--brand-product)]/10 hover:underline"
        >
          Restore to default
        </button>
      </div>

      <ul className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
        {orderedColumns.map((column, index) => {
          const isVisible = state.visible[column.id] !== false;
          const isLocked = Boolean(column.locked);

          return (
            <li
              key={column.id}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverIndex(index);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDrop(index);
              }}
              className={cn(
                "flex items-center gap-2 rounded-xl px-1.5 py-1.5 transition-colors",
                dragOverIndex === index &&
                  "bg-[var(--brand-product)]/8 ring-1 ring-[var(--brand-product)]/25",
                dragIndex === index && "opacity-50"
              )}
            >
              <span
                draggable
                title="Drag to reorder column"
                aria-label={`Reorder ${column.label} column`}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                  setDragIndex(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={cn(
                  "inline-flex shrink-0 cursor-grab touch-none items-center rounded-md p-1",
                  "text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                )}
              >
                <GripVerticalIcon className="size-3.5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {column.label}
              </span>
              <Switch
                checked={isVisible}
                disabled={isLocked}
                onCheckedChange={(checked) => toggleColumnVisibility(column.id, checked)}
                aria-label={`${isVisible ? "Hide" : "Show"} ${column.label} column`}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}
