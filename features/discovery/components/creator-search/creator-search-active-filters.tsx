"use client";

import { XIcon } from "lucide-react";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import {
  buildActiveFilterChips,
  countActiveCreatorSearchFilterChips,
  CREATOR_SEARCH_ACTIVE_FILTER_GROUPS,
  type ActiveFilterChip,
  type CreatorSearchFilterSectionId,
  type CreatorSearchFilters,
} from "./creator-search-types";

const CHIP_COLORS: Record<CreatorSearchFilterSectionId, string> = {
  search: "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-500/40 dark:bg-slate-500/10 dark:text-slate-200 dark:hover:bg-slate-500/20",
  creator: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20",
  audience: "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20",
  performance: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20",
  content: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20",
  ai: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100 dark:border-violet-500/35 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20",
  advanced: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-500/35 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20",
};

type Props = {
  aiFields?: string[];
  filters: CreatorSearchFilters;
  search?: string;
  onChange: (next: CreatorSearchFilters) => void;
  onClearSearch?: () => void;
  onClearAll?: () => void;
};

function FilterChipButton({
  chip,
  aiFields,
  filters,
  onChange,
  onClearSearch,
}: {
  chip: ActiveFilterChip;
  aiFields?: string[];
  filters: CreatorSearchFilters;
  onChange: (next: CreatorSearchFilters) => void;
  onClearSearch?: () => void;
}) {
  const groupLabel = CREATOR_SEARCH_ACTIVE_FILTER_GROUPS.find(group => group.id === chip.section)?.label;
  const label = `${Object.keys(chip.clear).some(k => aiFields?.includes(k)) ? "[AI] " : ""}${chip.label}`;
  return (
    <button
      key={chip.id}
      type="button"
      title={`${groupLabel}: ${label}`}
      aria-label={`Remove ${label} (${groupLabel})`}
      onClick={() => {
        if (chip.id === "topSearch") {
          onClearSearch?.();
          return;
        }
        onChange({ ...filters, ...chip.clear });
      }}
      className={cn(
        "group inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border py-1 pr-1.5 pl-2.5 text-[11px] font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        CHIP_COLORS[chip.section]
      )}
    >
      <span className="min-w-0 max-w-[220px] truncate">{label}</span>
      <XIcon aria-hidden="true" className="size-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export function CreatorSearchActiveFilters({
  filters,
  search = "",
  aiFields,
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
    <div role="group" aria-label="Active filters" className="flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-background px-4 py-2 md:px-5">
        <p className="sr-only">
          {totalCount} active filter{totalCount === 1 ? "" : "s"}
        </p>
        {groupedChips.flatMap(group => group.chips).map(chip => (
          <FilterChipButton
            key={chip.id}
            chip={chip}
            aiFields={aiFields}
            filters={filters}
            onChange={onChange}
            onClearSearch={onClearSearch}
          />
        ))}
        {onClearAll ? (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto min-h-7 shrink-0 rounded px-1 text-[11px] font-medium text-[#0057FF] transition-colors hover:text-[#0046cc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all
          </button>
        ) : null}
    </div>
  );
}
