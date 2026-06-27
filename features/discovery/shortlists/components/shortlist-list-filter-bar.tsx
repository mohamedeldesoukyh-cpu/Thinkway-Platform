"use client";

import { RotateCcwIcon } from "lucide-react";

import { OperationalTableSearchField } from "@/components/tables/operational-table-chrome";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ShortlistStatus, ShortlistVisibilityV2 } from "@/types/database";

import {
  SHORTLIST_STATUSES,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITIES,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import {
  DEFAULT_SHORTLIST_LIST_FILTERS,
  hasActiveShortlistListFilters,
  type ShortlistListFilterState,
} from "../shortlist-list-filters";
import type { ShortlistBrandOption } from "../types";

type Props = {
  filters: ShortlistListFilterState;
  onChange: (filters: ShortlistListFilterState) => void;
  brands?: ShortlistBrandOption[];
  resultCount: number;
  totalCount: number;
  className?: string;
};

export function ShortlistListFilterBar({
  filters,
  onChange,
  brands = [],
  resultCount,
  totalCount,
  className,
}: Props) {
  const showBrandFilter = brands.length > 0;
  const hasFilters = hasActiveShortlistListFilters(filters);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-2",
        className
      )}
    >
      <OperationalTableSearchField
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search })}
        onClear={() => onChange({ ...filters, search: "" })}
        placeholder="Search name or serial…"
      />

      <Select
        value={filters.status}
        onValueChange={(status) =>
          onChange({ ...filters, status: status as ShortlistStatus | "all" })
        }
      >
        <SelectTrigger className="h-8 w-[9.5rem] rounded-lg border-border/60 bg-background/80 text-xs">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {SHORTLIST_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {SHORTLIST_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.visibility}
        onValueChange={(visibility) =>
          onChange({
            ...filters,
            visibility: visibility as ShortlistVisibilityV2 | "all",
          })
        }
      >
        <SelectTrigger className="h-8 w-[9.5rem] rounded-lg border-border/60 bg-background/80 text-xs">
          <SelectValue placeholder="Visibility" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All visibility</SelectItem>
          {SHORTLIST_VISIBILITIES.map((visibility) => (
            <SelectItem key={visibility} value={visibility}>
              {SHORTLIST_VISIBILITY_LABELS[visibility]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showBrandFilter ? (
        <Select
          value={filters.brandId}
          onValueChange={(brandId) => onChange({ ...filters, brandId })}
        >
          <SelectTrigger className="h-8 min-w-[9.5rem] max-w-[14rem] rounded-lg border-border/60 bg-background/80 text-xs">
            <SelectValue placeholder="Brand" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name}
                {brand.client_name ? ` · ${brand.client_name}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      <span className="ml-auto text-[11px] text-muted-foreground">
        {resultCount === totalCount
          ? `${totalCount} shortlist${totalCount === 1 ? "" : "s"}`
          : `${resultCount} of ${totalCount}`}
      </span>

      {hasFilters ? (
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 gap-1 text-[11px] text-muted-foreground"
          onClick={() => onChange(DEFAULT_SHORTLIST_LIST_FILTERS)}
        >
          <RotateCcwIcon className="size-3" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}
