"use client";

import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageIconBadge,
} from "@/features/discovery/components/discovery-page-identity";
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

/** Single thin header row: identity + filters + create action (shortlist parity). */
export function QuotationsListMergedHeader({
  filters,
  onChange,
  brands,
  formOptions,
  resultCount,
  totalCount,
}: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-8 py-2.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <DiscoveryPageIconBadge
          identity={DISCOVERY_PAGE_IDENTITY.quotations}
          size="sm"
          className="size-8 rounded-[9px] [&_svg]:size-4"
        />
        <div className="min-w-0 leading-none">
          <h1 className="text-[15px] font-extrabold tracking-[-0.02em] text-[var(--text)]">
            Client quotations
          </h1>
          <p className="mt-0.5 hidden text-[11px] text-muted-foreground sm:block">
            Build, price, and export influencer proposals for clients.
          </p>
        </div>
      </div>

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
