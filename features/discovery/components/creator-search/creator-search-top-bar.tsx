"use client";

import { cn } from "@/lib/utils";

import { CreatorSearchInlineField } from "./creator-search-inline-field";
import type { CreatorSearchFilters, CreatorSearchSortState } from "./creator-search-types";
import { buildActiveFilterChips, CREATOR_SEARCH_SORT_FIELDS } from "./creator-search-types";
import { hasNormalSearchContext, NORMAL_SEARCH_SORTS } from "@/lib/discovery/normal-search";

export type CreatorSearchToolbarControlsProps = {
  searchQuery: string;
  onDebouncedSearchChange: (value: string) => void;
  onSearchSubmit: (value: string) => void;
  searchLoading?: boolean;
  sort: CreatorSearchSortState;
  onSortChange: (value: CreatorSearchSortState) => void;
  filters: CreatorSearchFilters;
  onFiltersChange: (filters: CreatorSearchFilters) => void;
  onOpenFilters: () => void;
  showCampaignRelevance?: boolean;
  onAddMissingCreator?: () => void;
  onRefreshMetrics?: () => void;
  className?: string;
};

/**
 * Pack card-header actions (`discovery.html` `pgSearch` tools):
 * search · Filters · Refresh metrics · + Add missing creator.
 */
export function CreatorSearchToolbarControls({
  searchQuery,
  onDebouncedSearchChange,
  onSearchSubmit,
  searchLoading,
  onOpenFilters,
  filters,
  onAddMissingCreator,
  onRefreshMetrics,
  className,
  sort,
  onSortChange,
}: CreatorSearchToolbarControlsProps) {
  const filterCount = buildActiveFilterChips(filters).length;
  const context = hasNormalSearchContext({ ...filters, search: searchQuery });

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <CreatorSearchInlineField
        searchQuery={searchQuery}
        onDebouncedSearchChange={onDebouncedSearchChange}
        onSearchSubmit={onSearchSubmit}
        loading={searchLoading}
      />
      <label className="inline-flex items-center gap-1 text-xs">
        Sort
        <select aria-label="Sort creators" className="tw-in" value={sort.field} onChange={e => onSortChange({ field: e.target.value as CreatorSearchSortState["field"], direction: e.target.value === "name" ? "asc" : "desc" })}>
          {CREATOR_SEARCH_SORT_FIELDS.filter(o => (NORMAL_SEARCH_SORTS as readonly string[]).includes(o.value) && (o.value !== "relevance" || context)).map(o => <option key={o.value} value={o.value}>{o.value === "relevance" ? "Relevance" : o.label}</option>)}
        </select>
        <button type="button" className="tw-b sm" aria-label="Reverse sort direction" onClick={() => onSortChange({ ...sort, direction: sort.direction === "asc" ? "desc" : "asc" })}>{sort.direction === "asc" ? "↑" : "↓"}</button>
      </label>
      <button type="button" className="tw-b sm" onClick={onOpenFilters}>
        Filters{filterCount > 0 ? ` · ${filterCount}` : ""}
      </button>
      {onRefreshMetrics ? (
        <button type="button" className="tw-b sm" onClick={onRefreshMetrics}>
          Refresh metrics
        </button>
      ) : null}
      {onAddMissingCreator ? (
        <button type="button" className="tw-b sm" onClick={onAddMissingCreator}>
          + Add missing creator
        </button>
      ) : null}
    </div>
  );
}
