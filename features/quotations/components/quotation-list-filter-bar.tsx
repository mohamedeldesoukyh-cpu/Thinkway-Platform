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
import { DiscoveryFilterBar } from "@/features/discovery/components/design-system";
import { cn } from "@/lib/utils";
import type { QuotationStatus } from "@/types/database";

import {
  QUOTATION_STATUSES,
  QUOTATION_STATUS_LABELS,
} from "../constants";
import {
  DEFAULT_QUOTATION_LIST_FILTERS,
  hasActiveQuotationListFilters,
  type QuotationListFilterState,
} from "../quotation-list-filters";

type BrandOption = {
  id: string;
  name: string;
  client_name?: string | null;
};

type Props = {
  filters: QuotationListFilterState;
  onChange: (filters: QuotationListFilterState) => void;
  brands?: BrandOption[];
  resultCount: number;
  totalCount: number;
  className?: string;
  /** When true, omits outer chrome — parent card supplies border/radius. */
  embedded?: boolean;
  /** Inline inside merged list header — no outer chrome. */
  inline?: boolean;
};

export function QuotationListFilterBar({
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
  const hasFilters = hasActiveQuotationListFilters(filters);
  const countLabel =
    resultCount === totalCount
      ? `${totalCount} quotation${totalCount === 1 ? "" : "s"}`
      : `${resultCount} of ${totalCount}`;

  const filterBarClass = inline
    ? cn("flex min-w-0 flex-1 flex-wrap items-center gap-2", className)
    : embedded
      ? cn(
          "flex flex-wrap items-center gap-2.5 border-b border-border px-8 pb-4",
          className
        )
      : cn("flex flex-wrap items-center gap-2.5", className);

  if (inline) {
    return (
      <div className={filterBarClass}>
        <div className="min-w-[180px] flex-1 sm:min-w-[220px]">
          <OperationalTableSearchField
            value={filters.search}
            onChange={(search) => onChange({ ...filters, search })}
            onClear={() => onChange({ ...filters, search: "" })}
            placeholder="Search name or serial…"
            variant="boxed"
            inputClassName="h-9 rounded-[11px] border-border bg-[var(--surface)] pl-[38px] text-[13px] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-background focus-visible:ring-[0_0_0_3px_rgba(0,87,255,0.14)]"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(status) =>
            onChange({ ...filters, status: status as QuotationStatus | "all" })
          }
        >
          <SelectTrigger className="h-9 min-w-[118px] rounded-[11px] border-border bg-background text-[12.5px] font-medium text-[var(--text-2)]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {QUOTATION_STATUSES.filter((status) => status !== "archived").map(
              (status) => (
                <SelectItem key={status} value={status}>
                  {QUOTATION_STATUS_LABELS[status]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {showBrandFilter ? (
          <Select
            value={filters.brandId}
            onValueChange={(brandId) => onChange({ ...filters, brandId })}
          >
            <SelectTrigger className="h-9 min-w-[118px] max-w-[11rem] rounded-[11px] border-border bg-background text-[12.5px] font-medium text-[var(--text-2)]">
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

        <span className="ml-auto text-[12px] font-semibold tracking-[0.01em] text-muted-foreground">
          {countLabel}
        </span>

        {hasFilters ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            className="h-7 gap-1 text-[11px] text-muted-foreground"
            onClick={() => onChange(DEFAULT_QUOTATION_LIST_FILTERS)}
          >
            <RotateCcwIcon className="size-3" />
            Reset
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <DiscoveryFilterBar embedded={embedded} className={filterBarClass}>
      <div className={cn(embedded && "min-w-[220px] flex-1")}>
        <OperationalTableSearchField
          value={filters.search}
          onChange={(search) => onChange({ ...filters, search })}
          onClear={() => onChange({ ...filters, search: "" })}
          placeholder="Search name or serial..."
          variant={embedded ? "boxed" : "ghost"}
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(status) =>
          onChange({ ...filters, status: status as QuotationStatus | "all" })
        }
      >
        <SelectTrigger
          className={cn(
            "h-9 min-w-[130px] rounded-[var(--tw-radius)] border-[var(--tw-border)] bg-background text-[12.5px] font-semibold text-[var(--text-2)]",
            !embedded && "h-8 w-[9.5rem]"
          )}
        >
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {QUOTATION_STATUSES.filter((status) => status !== "archived").map(
            (status) => (
              <SelectItem key={status} value={status}>
                {QUOTATION_STATUS_LABELS[status]}
              </SelectItem>
            )
          )}
        </SelectContent>
      </Select>

      {showBrandFilter ? (
        <Select
          value={filters.brandId}
          onValueChange={(brandId) => onChange({ ...filters, brandId })}
        >
          <SelectTrigger
            className={cn(
              "h-9 min-w-[130px] max-w-[14rem] rounded-[var(--tw-radius)] border-[var(--tw-border)] bg-background text-[12.5px] font-semibold text-[var(--text-2)]",
              !embedded && "h-8 min-w-[9.5rem]"
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
          "text-xs font-semibold text-[var(--text-3)]",
          embedded ? "ml-auto" : "ml-auto text-[11px]"
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
          onClick={() => onChange(DEFAULT_QUOTATION_LIST_FILTERS)}
        >
          <RotateCcwIcon className="size-3" />
          Reset
        </Button>
      ) : null}
    </DiscoveryFilterBar>
  );
}
