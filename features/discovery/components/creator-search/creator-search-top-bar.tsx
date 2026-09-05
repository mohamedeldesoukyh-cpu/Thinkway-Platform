"use client";

import { cn } from "@/lib/utils";

import { CreatorSearchInlineField } from "./creator-search-inline-field";
import type { CreatorSearchFilters, CreatorSearchSortState } from "./creator-search-types";

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
}: CreatorSearchToolbarControlsProps) {
  const filterCount = filters.platforms.length;

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <CreatorSearchInlineField
        searchQuery={searchQuery}
        onDebouncedSearchChange={onDebouncedSearchChange}
        onSearchSubmit={onSearchSubmit}
        loading={searchLoading}
      />
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
