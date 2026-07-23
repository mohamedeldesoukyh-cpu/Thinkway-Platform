"use client";

import { XIcon } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import {
  buildActiveFilterChips,
  clearCreatorSearchSectionFilters,
  countActiveCreatorSearchFilterChips,
  CREATOR_SEARCH_ACTIVE_FILTER_GROUPS,
  type ActiveFilterChip,
  type CreatorSearchFilterSectionId,
  type CreatorSearchFilters,
} from "./creator-search-types";

type Props = {
  filters: CreatorSearchFilters;
  search?: string;
  onChange: (next: CreatorSearchFilters) => void;
  onClearSearch?: () => void;
  onClearAll?: () => void;
};

function FilterChipButton({
  chip,
  filters,
  onChange,
  onClearSearch,
}: {
  chip: ActiveFilterChip;
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onClearSearch?: () => void;
}) {
  return (
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
        "group inline-flex items-center gap-1 rounded-full border border-[#9edfc8] dark:border-emerald-500/35 bg-[#ecfdf5] dark:bg-emerald-500/10 py-1 pr-1.5 pl-2.5",
        "text-[11px] font-medium text-[#168a66] dark:text-emerald-300 transition-colors hover:bg-[#d1fae5] dark:hover:bg-emerald-500/20"
      )}
    >
      <span className="max-w-[220px] truncate">{chip.label}</span>
      <XIcon className="size-3 opacity-60 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function CreatorSearchActiveFilters({
  filters,
  search = "",
  onChange,
  onClearSearch,
  onClearAll,
}: Props) {
  const chips = useMemo(() => buildActiveFilterChips(filters, search), [filters, search]);
  const totalCount = countActiveCreatorSearchFilterChips(filters, search);

  const groupedChips = useMemo(() => {
    const groups = new Map<CreatorSearchFilterSectionId, ActiveFilterChip[]>();
    for (const chip of chips) {
      const existing = groups.get(chip.section) ?? [];
      existing.push(chip);
      groups.set(chip.section, existing);
    }
    return CREATOR_SEARCH_ACTIVE_FILTER_GROUPS.filter((group) => (groups.get(group.id)?.length ?? 0) > 0).map(
      (group) => ({
        ...group,
        chips: groups.get(group.id) ?? [],
      })
    );
  }, [chips]);

  if (chips.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-col gap-2 border-b border-border bg-background px-4 py-2 md:px-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {totalCount} active filter{totalCount === 1 ? "" : "s"}
        </p>
        {onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="shrink-0 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc] dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        {groupedChips.map((group) => (
          <div key={group.id} className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="mr-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748b] dark:text-muted-foreground">
              {group.label} ({group.chips.length})
            </span>
            {group.chips.map((chip) => (
              <FilterChipButton
                key={chip.id}
                chip={chip}
                filters={filters}
                onChange={onChange}
                onClearSearch={onClearSearch}
              />
            ))}
            <button
              type="button"
              onClick={() => onChange(clearCreatorSearchSectionFilters(group.id, filters))}
              className="shrink-0 text-[10px] font-medium text-[#0057FF] underline-offset-2 hover:text-[#0046cc] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              Clear section
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
