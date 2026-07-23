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
  /** Flush list table strip (border + 32px gutters). */
  embedded?: boolean;
  /** Inline inside merged list header — no outer chrome. */
  inline?: boolean;
};

export function ShortlistListFilterBar({
  filters,
  onChange,
  brands = [],
  resultCount,
  totalCount,
  className,
  embedded = false,
  inline = false,
}: Props) {
  const showBrandFilter = brands.length > 0;
  const hasFilters = hasActiveShortlistListFilters(filters);
  const countLabel =
    resultCount === totalCount
      ? `${totalCount} shortlist${totalCount === 1 ? "" : "s"}`
      : `${resultCount} of ${totalCount}`;

  const filterBarClass = inline
    ? cn("flex min-w-0 flex-1 flex-wrap items-center gap-2", className)
    : embedded
      ? cn(
          "flex flex-wrap items-center gap-2.5 border-b border-border px-8 pb-4",
          className
        )
      : cn("flex flex-wrap items-center gap-2.5", className);

  return (
    <div className={filterBarClass}>
      <div className={cn((embedded || inline) && "min-w-[180px] flex-1 sm:min-w-[220px]")}>
        <OperationalTableSearchField
          value={filters.search}
          onChange={(search) => onChange({ ...filters, search })}
          onClear={() => onChange({ ...filters, search: "" })}
          placeholder="Search name or serial…"
          variant={embedded || inline ? "boxed" : "ghost"}
          inputClassName={
            embedded || inline
              ? "h-9 rounded-[11px] border-border bg-[var(--surface)] pl-[38px] text-[13px] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-[0_0_0_3px_rgba(0,87,255,0.14)]"
              : undefined
          }
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(status) =>
          onChange({ ...filters, status: status as ShortlistStatus | "all" })
        }
      >
        <SelectTrigger
          className={cn(
            "h-9 min-w-[118px] rounded-[11px] border-border bg-background text-[12.5px] font-medium text-[var(--text-2)]",
            !embedded && !inline && "h-8 w-[9.5rem] rounded-[var(--tw-radius)] text-[12.5px] font-semibold"
          )}
        >
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
        <SelectTrigger
          className={cn(
            "h-9 min-w-[118px] rounded-[11px] border-border bg-background text-[12.5px] font-medium text-[var(--text-2)]",
            !embedded && !inline && "h-8 w-[9.5rem] rounded-[var(--tw-radius)] text-[12.5px] font-semibold"
          )}
        >
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
          <SelectTrigger
            className={cn(
              "h-9 min-w-[118px] max-w-[11rem] rounded-[11px] border-border bg-background text-[12.5px] font-medium text-[var(--text-2)]",
              !embedded && !inline && "h-8 min-w-[9.5rem] rounded-[var(--tw-radius)] text-[12.5px] font-semibold"
            )}
          >
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

        <span
        className={cn(
          "ml-auto text-[12px] font-semibold tracking-[0.01em] text-muted-foreground"
        )}
      >
        {countLabel}
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
