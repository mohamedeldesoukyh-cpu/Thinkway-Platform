"use client";

import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import { buildActiveFilterChips, type CreatorSearchFilters } from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  search?: string;
  onChange: (next: CreatorSearchFilters) => void;
  onClearSearch?: () => void;
};

export function CreatorSearchActiveFilters({
  filters,
  search = "",
  onChange,
  onClearSearch,
}: Props) {
  const chips = buildActiveFilterChips(filters, search);
  if (chips.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-background px-4 py-2 md:px-5">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => {
            if (chip.id === "topSearch") {
              onClearSearch?.();
              return;
            }
            onChange({ ...filters, ...chip.clear });
          }}
          className={cn(
            "group inline-flex items-center gap-1 rounded-full border border-[#9edfc8] bg-[#ecfdf5] py-1 pr-1.5 pl-2.5",
            "text-[11px] font-medium text-[#168a66] transition-colors hover:bg-[#d1fae5]"
          )}
        >
          <span className="max-w-[220px] truncate">{chip.label}</span>
          <XIcon className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
        </button>
      ))}
    </div>
  );
}
