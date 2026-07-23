"use client";

import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageIconBadge,
} from "@/features/discovery/components/discovery-page-identity";
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

/** Single thin header row: identity + filters + create action. */
export function ShortlistsListMergedHeader({
  filters,
  onChange,
  brands,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-8 py-2.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <DiscoveryPageIconBadge
          identity={DISCOVERY_PAGE_IDENTITY.shortlists}
          size="sm"
          className="size-8 rounded-[9px] [&_svg]:size-4"
        />
        <div className="min-w-0 leading-none">
          <h1 className="text-[15px] font-extrabold tracking-[-0.02em] text-[var(--text)]">
            Shortlists
          </h1>
          <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
            Build, review, approve, and move creators into campaigns.
          </p>
        </div>
      </div>

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
