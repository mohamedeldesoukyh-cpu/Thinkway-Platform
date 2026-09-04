"use client";

import { CreateShortlistDialog } from "@/features/discovery/shortlists/components/create-shortlist-dialog";
import type { ShortlistBrandOption } from "@/features/discovery/shortlists/types";

import { ShortlistListFilterBar } from "./shortlist-list-filter-bar";
import type { ShortlistListFilterState } from "../shortlist-list-filters";

type Props = {
  filters: ShortlistListFilterState;
  onChange: (filters: ShortlistListFilterState) => void;
  brands: ShortlistBrandOption[];
  resultCount: number;
  totalCount: number;
};

/** Filters + create only — page title lives in DiscoverySuiteMasthead. */
export function ShortlistsListMergedHeader({
  filters,
  onChange,
  brands,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-4 py-2.5 md:px-5">
      <ShortlistListFilterBar
        filters={filters}
        onChange={onChange}
        brands={brands}
        resultCount={resultCount}
        totalCount={totalCount}
        inline
        className="min-w-0 flex-1"
      />

      <div className="ml-auto shrink-0 sm:ml-0">
        <CreateShortlistDialog brands={brands} />
      </div>
    </div>
  );
}
