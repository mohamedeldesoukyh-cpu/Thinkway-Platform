"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZIcon, ArrowUpAZIcon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  operationalTableChrome,
  OperationalTableIcons,
  OperationalTableToolbarButton,
} from "@/components/tables/operational-table-chrome";
import { useOperationalTableDataContext } from "@/components/tables/operational-table-data-context";
import { isColumnSortable } from "@/lib/tables/operational-table-filter-sort";
import { cn } from "@/lib/utils";

export function OperationalTableSortButton() {
  const { columns, sort, setTableSort, clearSort } = useOperationalTableDataContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const sortableColumns = useMemo(
    () => columns.filter((column) => isColumnSortable(column)),
    [columns]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return sortableColumns;
    }
    return sortableColumns.filter((column) =>
      column.label.toLowerCase().includes(needle)
    );
  }, [query, sortableColumns]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <OperationalTableToolbarButton
          icon={OperationalTableIcons.sort}
          label="Sort"
          active={Boolean(sort)}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className={cn(operationalTableChrome.panelShell, "w-72 overflow-hidden p-0")}
      >
        <div className="border-b border-border/50 px-3 py-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sort by field
          </p>
          <div className="relative">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2.25}
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter field name"
              className="h-9 rounded-xl border-border/50 bg-background pl-9 text-xs"
            />
          </div>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No sortable fields match.
            </li>
          ) : (
            filtered.map((column) => {
              const active = sort?.columnId === column.id;
              const direction = active ? sort.direction : null;
              return (
                <li key={column.id}>
                  <button
                    type="button"
                    onClick={() => setTableSort(column.id)}
                    className={cn(
                      "mx-1.5 flex w-[calc(100%-0.75rem)] items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                      "hover:bg-muted/60",
                      active &&
                        "bg-[var(--brand-product)]/8 font-medium text-[var(--brand-product)]"
                    )}
                  >
                    <span>{column.label}</span>
                    {active ? (
                      direction === "asc" ? (
                        <ArrowUpAZIcon className="size-4" strokeWidth={2.25} />
                      ) : (
                        <ArrowDownAZIcon className="size-4" strokeWidth={2.25} />
                      )
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        {sort ? (
          <div className="border-t border-border/50 px-3 py-2.5">
            <button
              type="button"
              className="text-xs font-medium text-[var(--brand-product)] hover:underline"
              onClick={() => {
                clearSort();
                setOpen(false);
              }}
            >
              Clear sort
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
