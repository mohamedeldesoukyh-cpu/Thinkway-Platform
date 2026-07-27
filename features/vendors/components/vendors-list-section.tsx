"use client";

import { Suspense, type ReactNode } from "react";

import {
  PlatformV6SectionMeta,
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
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
  crmOnly?: boolean;
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
  crmOnly = true,
  errorSlot,
}: VendorsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.vendors}
      columns={VENDORS_TABLE_COLUMNS}
      rows={vendors}
      filterAccessors={VENDORS_TABLE_FILTER_ACCESSORS}
    >
      <PlatformV6SectionMeta
        title={crmOnly ? "Commercial creators" : "All identities"}
        meta={meta}
      />
      <PlatformV6Toolbar>
        <Suspense fallback={null}>
          <OperationalTableToolbar contextLabel="Commercial CRM">
            <VendorsSearch />
            <VendorsFilters />
          </OperationalTableToolbar>
        </Suspense>
      </PlatformV6Toolbar>

      <PlatformV6SectionWrap>
        {errorSlot}

        {vendors.length === 0 ? (
          <VendorsEmptyState hasFilters={hasFilters} crmOnly={crmOnly} />
        ) : (
          <>
            <VendorsTable vendors={vendors} />
            <div className="border-t px-4 py-3 md:px-[14px]">
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
      </PlatformV6SectionWrap>
    </OperationalTableSuiteProvider>
  );
}
