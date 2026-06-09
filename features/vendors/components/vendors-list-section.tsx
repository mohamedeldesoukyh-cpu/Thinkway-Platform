"use client";

import { Suspense, type ReactNode } from "react";

import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { VendorsEmptyState } from "@/features/vendors/components/vendors-empty-state";
import { VendorsFilters } from "@/features/vendors/components/vendors-filters";
import { VendorsPagination } from "@/features/vendors/components/vendors-pagination";
import { VendorsSearch } from "@/features/vendors/components/vendors-search";
import { VENDORS_TABLE_COLUMNS, VendorsTable } from "@/features/vendors/components/vendors-table";
import type { VendorsListResult } from "@/features/vendors/queries";
import { VENDORS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import type { InfluencerStatus } from "@/types/database";

type VendorsListSectionProps = {
  vendors: VendorsListResult["vendors"];
  meta: string;
  hasFilters: boolean;
  page: number;
  totalPages: number;
  search: string;
  status?: InfluencerStatus;
  platform?: string;
  errorSlot?: ReactNode;
};

export function VendorsListSection({
  vendors,
  meta,
  hasFilters,
  page,
  totalPages,
  search,
  status,
  platform,
  errorSlot,
}: VendorsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.vendors}
      columns={VENDORS_TABLE_COLUMNS}
      rows={vendors}
      filterAccessors={VENDORS_TABLE_FILTER_ACCESSORS}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <div className="flex flex-col gap-3">
            <div className="min-w-0 space-y-0.5">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                All vendors
              </h2>
              <p className="text-[11px] leading-snug text-muted-foreground">{meta}</p>
            </div>
            <OperationalTableToolbar contextLabel="Vendors">
              <Suspense fallback={null}>
                <VendorsSearch />
              </Suspense>
              <Suspense fallback={null}>
                <VendorsFilters />
              </Suspense>
            </OperationalTableToolbar>
          </div>
        }
      >
        {errorSlot}

        {vendors.length === 0 ? (
          <VendorsEmptyState hasFilters={hasFilters} />
        ) : (
          <>
            <VendorsTable vendors={vendors} />
            <div className="border-t border-border/40 px-4 py-3 md:px-5">
              <VendorsPagination
                page={page}
                totalPages={totalPages}
                search={search}
                status={status}
                platform={platform}
              />
            </div>
          </>
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
