"use client";

import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { buildActiveFilterChips, type CreatorSearchFilters } from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onClearAll: () => void;
};

export function CreatorSearchActiveFilters({ filters, onChange, onClearAll }: Props) {
  const chips = buildActiveFilterChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-background px-4 py-2 md:px-5">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange({ ...filters, ...chip.clear })}
          className={cn(
            "group inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 py-1 pr-1.5 pl-2.5",
            "text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
          )}
        >
          <span className="max-w-[180px] truncate">{chip.label}</span>
          <XIcon className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="ml-1 text-[11px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
