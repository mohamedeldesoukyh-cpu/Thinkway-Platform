"use client";

import { CreateQuotationDialog } from "@/features/quotations/components/create-quotation-dialog";

import { QuotationListFilterBar } from "./quotation-list-filter-bar";
import type { QuotationListFilterState } from "../quotation-list-filters";

type BrandOption = {
  id: string;
  name: string;
  client_name?: string | null;
};

type Props = {
  filters: QuotationListFilterState;
  onChange: (filters: QuotationListFilterState) => void;
  brands: BrandOption[];
  formOptions: Parameters<typeof CreateQuotationDialog>[0]["options"];
  resultCount: number;
  totalCount: number;
};

/** Filters + create only — page title lives in DiscoverySuiteMasthead. */
export function QuotationsListMergedHeader({
  filters,
  onChange,
  brands,
  formOptions,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-4 py-2.5 md:px-5">
      <QuotationListFilterBar
        filters={filters}
        onChange={onChange}
        brands={brands}
        resultCount={resultCount}
        totalCount={totalCount}
        inline
        className="min-w-0 flex-1"
      />

      <div className="ml-auto shrink-0 sm:ml-0">
        <CreateQuotationDialog options={formOptions} />
      </div>
    </div>
  );
}
