"use client";

import { useMemo, useState } from "react";
import { ListFilterIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { operationalTableChrome } from "@/components/tables/operational-table-chrome";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOperationalTableDataContext } from "@/components/tables/operational-table-data-context";
import {
  BLANK_FILTER_VALUE,
  createEmptyFilter,
  deriveEnumOptions,
  hasActiveFilters,
  isColumnFilterable,
  type ColumnFilterValue,
  type OperationalTableFilterType,
} from "@/lib/tables/operational-table-filter-sort";
import { cn } from "@/lib/utils";

const ENUM_PREVIEW_COUNT = 6;

type OperationalTableFilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OperationalTableFilterSheet({
  open,
  onOpenChange,
}: OperationalTableFilterSheetProps) {
  const {
    filterColumns,
    sourceRows,
    filters,
    filterTypes,
    setColumnFilter,
    clearFilters,
  } = useOperationalTableDataContext();

  const filterableColumns = useMemo(
    () => filterColumns.filter((column) => isColumnFilterable(column)),
    [filterColumns]
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          operationalTableChrome.panelShell,
          "flex w-full flex-col gap-0 border-l-0 p-0 sm:max-w-md"
        )}
      >
        <SheetHeader className="border-b border-border/50 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <ListFilterIcon className="size-4 text-muted-foreground" strokeWidth={2} />
              Filter
            </SheetTitle>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 rounded-xl hover:bg-muted"
              >
                <XIcon className="size-4" />
                <span className="sr-only">Close filter panel</span>
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {filterableColumns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No filterable columns configured for this table.
            </p>
          ) : (
            filterableColumns.map((column) => {
              const filterType = filterTypes[column.id] ?? "text";
              const current =
                filters[column.id] ?? createEmptyFilter(filterType);

              return (
                <FilterField
                  key={column.id}
                  label={column.label}
                  filterType={filterType}
                  value={current}
                  enumOptions={
                    filterType === "enum"
                      ? deriveEnumOptions(sourceRows, column)
                      : []
                  }
                  onChange={(next) => setColumnFilter(column.id, next)}
                />
              );
            })
          )}
        </div>

        <div className="border-t border-border/50 px-5 py-4">
          <Button
            type="button"
            variant="link"
            className={cn(
              "h-auto rounded-md px-1.5 py-0.5 text-[var(--brand-product)] hover:bg-[var(--brand-product)]/10",
              !hasActiveFilters(filters) && "pointer-events-none opacity-40"
            )}
            onClick={clearFilters}
            disabled={!hasActiveFilters(filters)}
          >
            Clear filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterField({
  label,
  filterType,
  value,
  enumOptions,
  onChange,
}: {
  label: string;
  filterType: OperationalTableFilterType;
  value: ColumnFilterValue;
  enumOptions: string[];
  onChange: (value: ColumnFilterValue) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold tracking-wide text-foreground/85">
        {label}
      </Label>
      {filterType === "text" && value.type === "text" ? (
        <Input
          value={value.query}
          onChange={(event) => onChange({ type: "text", query: event.target.value })}
          placeholder="Enter text"
          className="h-9 rounded-xl border-border/50 bg-background text-xs"
        />
      ) : null}

      {filterType === "date" && value.type === "date" ? (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="date"
            value={value.from}
            onChange={(event) =>
              onChange({ type: "date", from: event.target.value, to: value.to })
            }
            className="h-9 rounded-xl border-border/50 bg-background text-xs"
            aria-label={`${label} from`}
          />
          <Input
            type="date"
            value={value.to}
            onChange={(event) =>
              onChange({ type: "date", from: value.from, to: event.target.value })
            }
            className="h-9 rounded-xl border-border/50 bg-background text-xs"
            aria-label={`${label} to`}
          />
        </div>
      ) : null}

      {filterType === "number" && value.type === "number" ? (
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={value.from}
            onChange={(event) =>
              onChange({ type: "number", from: event.target.value, to: value.to })
            }
            placeholder="From"
            className="h-9 rounded-xl border-border/50 bg-background text-xs"
          />
          <Input
            value={value.to}
            onChange={(event) =>
              onChange({ type: "number", from: value.from, to: event.target.value })
            }
            placeholder="to"
            className="h-9 rounded-xl border-border/50 bg-background text-xs"
          />
        </div>
      ) : null}

      {filterType === "enum" && value.type === "enum" ? (
        <EnumFilterList
          options={enumOptions}
          selected={value.values}
          onChange={(values) => onChange({ type: "enum", values })}
        />
      ) : null}

      {filterType === "boolean" && value.type === "boolean" ? (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Any", value: null },
            { label: "Yes", value: true },
            { label: "No", value: false },
          ].map((option) => (
            <label key={option.label} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`filter-bool-${label}`}
                checked={value.value === option.value}
                onChange={() => onChange({ type: "boolean", value: option.value })}
                className="size-4 rounded-full border border-input"
              />
              {option.label}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EnumFilterList({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, ENUM_PREVIEW_COUNT);
  const hiddenCount = Math.max(0, options.length - ENUM_PREVIEW_COUNT);

  function toggle(value: string) {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  }

  return (
    <div className="space-y-2">
      {visible.map((option) => (
        <label
          key={option}
          className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-sm transition-colors hover:bg-muted/50"
        >
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={() => toggle(option)}
            className="size-4 rounded-md border border-input accent-[var(--brand-product)]"
          />
          <span>{option === BLANK_FILTER_VALUE ? "(Blanks)" : option}</span>
        </label>
      ))}
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-sm font-medium text-[var(--brand-product)] hover:underline"
        >
          {expanded ? "Less" : `More (${hiddenCount})`}
        </button>
      ) : null}
    </div>
  );
}
