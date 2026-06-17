"use client";

import { Suspense, type ReactNode } from "react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { BrandsEmptyState } from "@/features/brands/components/brands-empty-state";
import { BrandsPagination } from "@/features/brands/components/brands-pagination";
import { BrandsSearch } from "@/features/brands/components/brands-search";
import { BRANDS_TABLE_COLUMNS, BrandsTable } from "@/features/brands/components/brands-table";
import type { BrandsListResult } from "@/features/brands/queries";
import { BRANDS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type BrandsListSectionProps = {
  brands: BrandsListResult["brands"];
  meta: string;
  hasSearch: boolean;
  hasClients: boolean;
  page: number;
  totalPages: number;
  search: string;
  errorSlot?: ReactNode;
};

export function BrandsListSection({
  brands,
  meta,
  hasSearch,
  hasClients,
  page,
  totalPages,
  search,
  errorSlot,
}: BrandsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.brands}
      columns={BRANDS_TABLE_COLUMNS}
      rows={brands}
      filterAccessors={BRANDS_TABLE_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                All brands
              </h2>
              <p className="text-[11px] leading-snug text-muted-foreground">{meta}</p>
            </div>
            <Suspense fallback={null}>
              <OperationalTableToolbar contextLabel="Brands">
                <BrandsSearch />
              </OperationalTableToolbar>
            </Suspense>
          </div>
        }
      >
        {errorSlot}

        {brands.length === 0 ? (
          <BrandsEmptyState hasSearch={hasSearch} hasClients={hasClients} />
        ) : (
          <>
            <BrandsTable brands={brands} />
            <div className="border-t border-border/40 px-4 py-3 md:px-5">
              <BrandsPagination page={page} totalPages={totalPages} search={search} />
            </div>
          </>
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
