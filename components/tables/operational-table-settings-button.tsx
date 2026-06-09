"use client";

import { useCallback, useState } from "react";
import { GripVerticalIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  operationalTableChrome,
  OperationalTableIcons,
  OperationalTableToolbarButton,
} from "@/components/tables/operational-table-chrome";
import { useOperationalTableColumnsContext } from "@/components/tables/operational-table-column-context";
import { cn } from "@/lib/utils";

type OperationalTableSettingsButtonProps = {
  contextLabel: string;
};

export function OperationalTableSettingsButton({
  contextLabel,
}: OperationalTableSettingsButtonProps) {
  const {
    orderedColumns,
    state,
    toggleColumnVisibility,
    moveColumn,
    resetToDefault,
  } = useOperationalTableColumnsContext();

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
    <Popover>
      <PopoverTrigger asChild>
        <OperationalTableToolbarButton
          icon={OperationalTableIcons.settings}
          label="Settings"
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(
          operationalTableChrome.panelShell,
          "w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-0"
        )}
      >
        <div className="border-b border-border/50 px-4 py-3.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {contextLabel}
          </p>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">
            Table settings
          </h3>
        </div>

        <div className="px-4 py-3">
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
                    onCheckedChange={(checked) =>
                      toggleColumnVisibility(column.id, checked)
                    }
                    aria-label={`${isVisible ? "Hide" : "Show"} ${column.label} column`}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
