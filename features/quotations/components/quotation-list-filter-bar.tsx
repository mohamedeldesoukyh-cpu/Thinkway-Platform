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
};

export function QuotationListFilterBar({
  filters,
  onChange,
  brands = [],
  resultCount,
  totalCount,
  className,
}: Props) {
  const showBrandFilter = brands.length > 0;
  const hasFilters = hasActiveQuotationListFilters(filters);

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
          onChange({ ...filters, status: status as QuotationStatus | "all" })
        }
      >
        <SelectTrigger className="h-8 w-[9.5rem] rounded-lg border-border/60 bg-background/80 text-xs">
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
          ? `${totalCount} quotation${totalCount === 1 ? "" : "s"}`
          : `${resultCount} of ${totalCount}`}
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
