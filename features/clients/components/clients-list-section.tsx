"use client";

import { Suspense, type ReactNode } from "react";

import {
  PlatformV6SectionMeta,
  PlatformV6SectionWrap,
  PlatformV6Toolbar,
} from "@/components/platform/platform-v6-layout";
import { OperationalTableToolbar } from "@/components/tables/operational-table-toolbar";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { ClientsEmptyState } from "@/features/clients/components/clients-empty-state";
import { ClientsPagination } from "@/features/clients/components/clients-pagination";
import { ClientsSearch } from "@/features/clients/components/clients-search";
import { CLIENTS_TABLE_COLUMNS, ClientsTable } from "@/features/clients/components/clients-table";
import type { ClientsListResult } from "@/features/clients/queries";
import { CLIENTS_TABLE_FILTER_ACCESSORS } from "@/lib/tables/list-table-filter-fields";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";

type ClientsListSectionProps = {
  clients: ClientsListResult["clients"];
  meta: string;
  hasSearch: boolean;
  page: number;
  totalPages: number;
  search: string;
  errorSlot?: ReactNode;
};

export function ClientsListSection({
  clients,
  meta,
  hasSearch,
  page,
  totalPages,
  search,
  errorSlot,
}: ClientsListSectionProps) {
  return (
    <OperationalTableSuiteProvider
      tableId={OPERATIONAL_TABLE_IDS.clients}
      columns={CLIENTS_TABLE_COLUMNS}
      rows={clients}
      filterAccessors={CLIENTS_TABLE_FILTER_ACCESSORS}
    >
      <PlatformV6SectionMeta title="All clients" meta={meta} />
      <PlatformV6Toolbar>
        <Suspense fallback={null}>
          <OperationalTableToolbar contextLabel="Clients">
            <ClientsSearch />
          </OperationalTableToolbar>
        </Suspense>
      </PlatformV6Toolbar>

      <PlatformV6SectionWrap>
        {errorSlot}

        {clients.length === 0 ? (
          <ClientsEmptyState hasSearch={hasSearch} />
        ) : (
          <>
            <ClientsTable clients={clients} />
            <div className="border-t px-4 py-3 md:px-[14px]">
              <ClientsPagination page={page} totalPages={totalPages} search={search} />
            </div>
          </>
        )}
      </PlatformV6SectionWrap>
    </OperationalTableSuiteProvider>
  );
}
